import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyAgent } from "@/lib/agent-auth.server";

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(100) });

export const Route = createFileRoute("/api/public/agent/commands")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const db = await verifyAgent(request);
        if (!db) return Response.json({ error: "unauthorized" }, { status: 401 });
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
        const { error } = await db.from("turnstile_commands")
          .update({ executed_at: new Date().toISOString() })
          .in("id", parsed.data.ids)
          .is("executed_at", null);
        if (error) return Response.json({ error: "db" }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
