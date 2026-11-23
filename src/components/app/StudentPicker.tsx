import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export function useStudentList() {
  return useQuery({
    queryKey: ["students-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, name, matricula, status").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function StudentPicker({
  value,
  onChange,
  placeholder = "Selecione o aluno…",
  allowEmpty,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  allowEmpty?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data } = useStudentList();
  const sel = data?.find((s) => s.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">{sel ? `${sel.matricula} · ${sel.name}` : value === null && allowEmpty ? allowEmpty : placeholder}</span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Nome ou matrícula…" />
          <CommandList>
            <CommandEmpty>Nenhum aluno.</CommandEmpty>
            <CommandGroup>
              {allowEmpty && (
                <CommandItem
                  value="__none"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  {allowEmpty}
                </CommandItem>
              )}
              {(data ?? []).map((s) => (
                <CommandItem
                  key={s.id}
                  value={`${s.matricula} ${s.name}`}
                  onSelect={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-1 h-4 w-4", value === s.id ? "opacity-100" : "opacity-0")} />
                  <span className="mr-2 font-mono text-xs text-muted-foreground">{s.matricula}</span>
                  {s.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
