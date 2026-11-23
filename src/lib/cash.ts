import { supabase } from "@/integrations/supabase/client";

export const PAYMENT_METHODS = ["Dinheiro", "Pix", "Cartão de débito", "Cartão de crédito"];

export async function getOpenSession() {
  const { data } = await supabase.from("cash_sessions").select("*").is("closed_at", null).order("opened_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

/** Record money in/out of the open cash session (no-op when the cash register is closed). */
export async function recordCash(type: "entrada" | "saida", amount: number, method: string, description: string) {
  const session = await getOpenSession();
  if (!session) return false;
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("cash_movements").insert({ session_id: session.id, type, amount, method, description, created_by: u.user?.id ?? null });
  return true;
}
