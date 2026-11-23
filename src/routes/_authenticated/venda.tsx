import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Field, SearchBox, grid } from "@/components/app/common";
import { StudentPicker } from "@/components/app/StudentPicker";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProducts } from "@/hooks/use-data";
import { brl, fmtDateTime, errMsg } from "@/lib/format";
import { PAYMENT_METHODS, recordCash } from "@/lib/cash";

export const Route = createFileRoute("/_authenticated/venda")({
  head: () => ({
    meta: [
      { title: "Venda de Produtos — ALT FITNESS" },
      { name: "description", content: "Venda rápida de água, suplementos, diárias e camisetas." },
      { property: "og:title", content: "Venda de Produtos — ALT FITNESS" },
      { property: "og:description", content: "Venda rápida de água, suplementos, diárias e camisetas." },
    ],
  }),
  component: VendaPage,
});

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

function VendaPage() {
  const qc = useQueryClient();
  const { data: products = [] } = useProducts();
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [student, setStudent] = useState<string | null>(null);
  const [method, setMethod] = useState("Dinheiro");
  const total = cart.reduce((a, i) => a + i.price * i.qty, 0);

  const { data: recent = [] } = useQuery({
    queryKey: ["sales-recent"],
    queryFn: async () => (await supabase.from("sales").select("*, students(name), sale_items(product_name, quantity)").order("created_at", { ascending: false }).limit(15)).data ?? [],
  });

  const add = (p: { id: string; name: string; price: number }) =>
    setCart((c) => {
      const ex = c.find((i) => i.id === p.id);
      return ex ? c.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i)) : [...c, { id: p.id, name: p.name, price: Number(p.price), qty: 1 }];
    });
  const qty = (id: string, d: number) => setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: Math.max(1, i.qty + d) } : i)));

  const finish = useMutation({
    mutationFn: async () => {
      if (!cart.length) throw new Error("Adicione produtos.");
      const { data: u } = await supabase.auth.getUser();
      const { data: sale, error } = await supabase
        .from("sales")
        .insert({ student_id: student, total, payment_method: method, created_by: u.user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      const { error: e2 } = await supabase
        .from("sale_items")
        .insert(cart.map((i) => ({ sale_id: sale.id, product_id: i.id, product_name: i.name, quantity: i.qty, unit_price: i.price })));
      if (e2) throw e2;
      const inCash = await recordCash("entrada", total, method, `Venda: ${cart.map((i) => `${i.qty}x ${i.name}`).join(", ")}`);
      return inCash;
    },
    onSuccess: (inCash) => {
      toast.success(`Venda concluída — ${brl(total)}${inCash ? "" : " (caixa fechado: não lançada no caixa)"}`);
      setCart([]);
      setStudent(null);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["sales-recent"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const list = products.filter((p) => p.active && p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <ModuleWindow module="vendas">
      <div className="grid h-full lg:grid-cols-[1fr_380px]">
        <div className="p-3">
          <SearchBox value={q} onChange={setQ} placeholder="Buscar produto" />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p)}
                disabled={p.stock <= 0}
                className="rounded-lg border border-border bg-card p-3 text-left shadow-tile transition hover:border-primary hover:bg-primary/5 disabled:opacity-40"
              >
                <span className="block font-semibold">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.category}</span>
                <span className="mt-2 block font-display text-xl font-bold text-primary-deep">{brl(p.price)}</span>
                <span className="text-xs text-muted-foreground">Estoque: {p.stock >= 9999 ? "∞" : p.stock}</span>
              </button>
            ))}
          </div>
          <h3 className="mt-6 text-lg font-bold">Últimas vendas</h3>
          <table className={grid.table}>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id} className={grid.tr}>
                  <td className={grid.td}>{fmtDateTime(s.created_at)}</td>
                  <td className={`${grid.td} text-xs`}>{s.sale_items.map((i) => `${i.quantity}x ${i.product_name}`).join(", ")}</td>
                  <td className={grid.td}>{s.students?.name ?? "Avulso"}</td>
                  <td className={grid.td}>{s.payment_method}</td>
                  <td className={`${grid.td} text-right font-semibold`}>{brl(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside className="flex flex-col border-l border-border bg-muted/40 p-3">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <ShoppingCart className="h-5 w-5 text-primary" /> Carrinho
          </h3>
          <ul className="my-3 flex-1 space-y-2 overflow-auto">
            {cart.map((i) => (
              <li key={i.id} className="flex items-center gap-2 rounded-md border border-border bg-card p-2 text-sm">
                <span className="flex-1">{i.name}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => qty(i.id, -1)}>
                  <Minus />
                </Button>
                <span className="w-6 text-center tabular-nums">{i.qty}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => qty(i.id, 1)}>
                  <Plus />
                </Button>
                <span className="w-20 text-right">{brl(i.price * i.qty)}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setCart((c) => c.filter((x) => x.id !== i.id))}>
                  <Trash2 className="text-destructive" />
                </Button>
              </li>
            ))}
            {!cart.length && <li className="text-sm text-muted-foreground">Clique nos produtos para adicionar.</li>}
          </ul>
          <div className="space-y-3 border-t border-border pt-3">
            <Field label="Aluno (opcional)">
              <StudentPicker value={student} onChange={setStudent} allowEmpty="Venda avulsa" placeholder="Venda avulsa" />
            </Field>
            <Field label="Pagamento">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-end justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-3xl font-extrabold text-primary-deep">{brl(total)}</span>
            </div>
            <Button variant="hero" size="lg" className="w-full" onClick={() => finish.mutate()} disabled={!cart.length || finish.isPending}>
              Finalizar venda
            </Button>
          </div>
        </aside>
      </div>
    </ModuleWindow>
  );
}
