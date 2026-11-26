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
            .eq("command", "liberar")
            .is("executed_at", null)
            .gte("created_at", new Date(Date.now() - 60_000).toISOString())
            .order("created_at", { ascending: true })
            .limit(100);
          cmds = data ?? [];
        }
        await (db as any).from("settings").update({ agent_last_seen: new Date().toISOString(), agent_version: request.headers.get("x-agent-version") }).eq("id", 1);
        if (onlyCommands) return Response.json({ commands: cmds });

        const [{ data: settings }, { data: students }, { data: qrSecrets }] = await Promise.all([
          (db as any).from("settings").select("tolerance_days, turnstile_ip, turnstile_port, release_seconds, block_inactive, welcome_message, allow_card, allow_matricula, allow_password, allow_qrcode, allow_sko12, allow_face, dynamic_qr_enabled").eq("id", 1).single(),
          db.from("student_overview").select("id, matricula, name, status, access_password, card_number, qr_code, valid_until, overdue_since").limit(5000),
          db.from("student_qr_secrets").select("student_id, secret"),
        ]);
        // This private, agent-token-protected endpoint is the only client allowed to receive QR secrets.
        const secretByStudent = new Map((qrSecrets ?? []).map((row) => [row.student_id, row.secret]));
        const agentStudents = (students ?? []).map((student) => ({
          ...student,
          qr_secret: secretByStudent.get(student.id) ?? null,
        }));
        return Response.json({ settings, students: agentStudents, commands: [] });
      },
    },
  },
});
