import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export function StudentSearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["student-search", q],
    enabled: open,
    queryFn: async () => {
      let req = supabase.from("students").select("id, name, matricula, status").order("name").limit(20);
      if (q.trim()) {
        const n = Number(q);
        req = Number.isFinite(n) && q.trim() !== "" ? req.eq("matricula", n) : req.ilike("name", `%${q}%`);
      }
      const { data } = await req;
      return data ?? [];
    },
  });
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Nome ou número de matrícula…" value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
        <CommandGroup heading="Alunos">
          {(data ?? []).map((s) => (
            <CommandItem
              key={s.id}
              value={`${s.matricula} ${s.name}`}
              onSelect={() => {
                onOpenChange(false);
                navigate({ to: "/alunos", search: { id: s.id } });
              }}
            >
              <span className="mr-2 font-mono text-xs text-muted-foreground">{s.matricula}</span>
              {s.name}
              <span className="ml-auto text-xs capitalize text-muted-foreground">{s.status}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
