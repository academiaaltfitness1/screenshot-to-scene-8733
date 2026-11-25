import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyAgent } from "@/lib/agent-auth.server";

const schema = z.object({
  events: z
    .array(
      z.object({
        student_id: z.string().uuid().nullable(),
        credential: z.string().max(60).nullable(),
        source: z.enum(["catraca", "teclado", "qrcode", "cartao", "digital", "facial", "remoto"]),
        allowed: z.boolean(),
        reason: z.string().max(80).nullable(),
        direction: z.enum(["entrada", "saida"]),
        occurred_at: z.string().datetime(),
      }),
    )
    .max(500),
});

export const Route = createFileRoute("/api/public/agent/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const db = await verifyAgent(request);
        if (!db) return Response.json({ error: "unauthorized" }, { status: 401 });
        const parsed = schema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "invalid" }, { status: 400 });
        if (parsed.data.events.length) {
          const { error } = await db.from("attendance").insert(parsed.data.events);
          if (error) return Response.json({ error: "db" }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
