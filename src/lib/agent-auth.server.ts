/** Server-only: validates the Local Agent token sent in the x-agent-token header. */
export async function verifyAgent(request: Request) {
  const token = request.headers.get("x-agent-token") ?? "";
  if (token.length < 20 || token.length > 200) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("agent_credentials").select("token").eq("id", 1).maybeSingle();
  if (!data || data.token.length !== token.length) return null;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ data.token.charCodeAt(i);
  return diff === 0 ? supabaseAdmin : null;
}
