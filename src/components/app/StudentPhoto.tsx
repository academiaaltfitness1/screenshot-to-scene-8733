import { useQuery } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function StudentPhoto({ path, className }: { path: string | null | undefined; className?: string }) {
  const { data: url } = useQuery({
    queryKey: ["photo", path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.storage.from("fotos").createSignedUrl(path!, 3600);
      return data?.signedUrl ?? null;
    },
  });
  return (
    <div className={cn("flex items-center justify-center overflow-hidden rounded-md border border-border bg-muted", className)}>
      {url ? <img src={url} alt="Foto do aluno" className="h-full w-full object-cover" /> : <UserRound className="h-1/2 w-1/2 text-muted-foreground" />}
    </div>
  );
}
