import { createFileRoute } from "@tanstack/react-router";
import { verifyAgent } from "@/lib/agent-auth.server";

export const Route = createFileRoute("/api/public/agent/sync")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const db = await verifyAgent(request);
        if (!db) return Response.json({ error: "unauthorized" }, { status: 401 });
        const onlyCommands = new URL(request.url).searchParams.get("only") === "commands";

        let cmds: { id: string }[] = [];
        if (onlyCommands) {
          const { data } = await db.from("turnstile_commands").select("id")
            .is("executed_at", null)
            .gte("created_at", new Date(Date.now() - 60_000).toISOString())
            .order("created_at", { ascending: true })
            .limit(100);
          cmds = data ?? [];
        }
        await db.from("settings").update({ agent_last_seen: new Date().toISOString() }).eq("id", 1);
        if (onlyCommands) return Response.json({ commands: cmds });

        const [{ data: settings }, { data: students }] = await Promise.all([
          db.from("settings").select("tolerance_days, turnstile_ip, turnstile_port, release_seconds, block_inactive, welcome_message").eq("id", 1).single(),
          db.from("student_overview").select("id, matricula, name, status, access_password, card_number, qr_code, valid_until, overdue_since").limit(5000),
        ]);
        return Response.json({ settings, students: students ?? [], commands: [] });
      },
    },
  },
});
