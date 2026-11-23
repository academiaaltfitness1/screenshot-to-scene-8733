import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useProducts } from "@/hooks/use-data";
import { ModuleWindow } from "@/components/shell/ModuleWindow";
import { Field, ModuleBar, SearchBox, EmptyRow, grid } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStaff } from "@/hooks/use-staff";
import { brl, errMsg } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({
    meta: [
      { title: "Cadastro de Produtos — ALT FITNESS" },
      { name: "description", content: "Produtos, preços e estoque da academia." },
      { property: "og:title", content: "Cadastro de Produtos — ALT FITNESS" },
      { property: "og:description", content: "Produtos, preços e estoque da academia." },
    ],
  }),
  component: ProdutosPage,
});

type Product = Tables<"products">;


function ProdutosPage() {
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Partial<Product> | null>(null);
  const { data: rows = [], isLoading } = useProducts();
  const filtered = useMemo(() => rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()) || r.category.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  return (
    <ModuleWindow
      module="produtos"
      actions={
        <Button size="sm" variant="accent" onClick={() => setEdit({ category: "Geral", active: true, stock: 0, min_stock: 0 })}>
          <Plus /> Novo produto
        </Button>
      }
    >
      <ModuleBar>
        <SearchBox value={q} onChange={setQ} placeholder="Produto ou categoria" />
      </ModuleBar>
      <table className={grid.table}>
        <thead className={grid.thead}>
          <tr>
            <th className={grid.th}>Produto</th>
            <th className={grid.th}>Categoria</th>
            <th className={grid.th}>Custo</th>
            <th className={grid.th}>Preço</th>
            <th className={grid.th}>Estoque</th>
            <th className={grid.th}>Ativo</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <EmptyRow cols={6} text="Carregando…" />}
          {filtered.map((p) => (
            <tr key={p.id} className={`${grid.tr} cursor-pointer`} onClick={() => setEdit(p)}>
              <td className={`${grid.td} font-semibold`}>{p.name}</td>
              <td className={grid.td}>{p.category}</td>
              <td className={grid.td}>{brl(p.cost)}</td>
              <td className={grid.td}>{brl(p.price)}</td>
              <td className={grid.td}>
                <Badge variant={p.stock <= p.min_stock ? "destructive" : "secondary"}>{p.stock >= 9999 ? "∞" : p.stock}</Badge>
              </td>
              <td className={grid.td}>{p.active ? "Sim" : "Não"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {edit && <ProductDialog p={edit} onClose={() => setEdit(null)} />}
    </ModuleWindow>
  );
}

function ProductDialog({ p, onClose }: { p: Partial<Product>; onClose: () => void }) {
  const qc = useQueryClient();
  const { staff } = useStaff();
  const [f, setF] = useState<Record<string, string | boolean | number | null | undefined>>(p);
  const num = (v: unknown) => Number(String(v ?? 0).replace(",", "."));
  const save = useMutation({
    mutationFn: async () => {
      if (!f["name"]) throw new Error("Informe o nome.");
      const payload = {
        name: String(f["name"]),
        category: String(f["category"] ?? "Geral"),
        price: num(f["price"]),
        cost: num(f["cost"]),
        stock: Math.round(num(f["stock"])),
        min_stock: Math.round(num(f["min_stock"])),
        active: f["active"] !== false,
      };
      const { error } = p.id ? await supabase.from("products").update(payload).eq("id", p.id) : await supabase.from("products").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produto salvo");
      qc.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = async () => {
    if (!confirm("Excluir produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id!);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["products"] });
    onClose();
  };
  const inp = (k: string, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <Field label={label}>
      <Input value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
    </Field>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{p.id ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">{inp("name", "Nome")}</div>
          {inp("category", "Categoria")}
          {inp("price", "Preço de venda", { inputMode: "decimal" })}
          {inp("cost", "Custo", { inputMode: "decimal" })}
          {inp("stock", "Estoque", { inputMode: "numeric" })}
          {inp("min_stock", "Estoque mínimo", { inputMode: "numeric" })}
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <Checkbox checked={f["active"] !== false} onCheckedChange={(v) => setF({ ...f, active: !!v })} /> Produto ativo
          </label>
        </div>
        <DialogFooter className="gap-2">
          {p.id && staff?.isAdmin && (
            <Button variant="destructive" className="mr-auto" onClick={remove}>
              <Trash2 /> Excluir
            </Button>
          )}
          <Button variant="hero" onClick={() => save.mutate()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
