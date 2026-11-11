import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { LanguageModel } from "ai";
import { z } from "zod";
import type { AgentDeps } from "./agent/actions";
import { runAgent } from "./agent/agent";
import { circleView } from "./circle-view";
import type { PayPalClient } from "./engine/paypal-client";
import { approvePayout, checkReleasingPayouts } from "./payouts/approval";
import type { CircleStore } from "./store/circle-store";
import { logError } from "./redact";
import { handlePayPalWebhook } from "./webhooks/paypal-webhook";

// The demo URL is public and every agent call spends model credits; one visitor can't use up everyone's hour.
const AGENT_CALLS_PER_HOUR = 60;
const AGENT_CALLS_PER_VISITOR_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;
// Chat history is capped at 40 short messages and PayPal events are a few KB.
const MAX_BODY_BYTES = 100 * 1024;

// Render's proxy appends the caller's address last; earlier entries are whatever the client sent.
function visitor(forwardedFor: string | undefined): string {
  return forwardedFor?.split(",").at(-1)?.trim() || "direct";
}

export type AppDeps = {
  store: CircleStore;
  paypal: () => Pick<
    PayPalClient,
    "createInvoice" | "sendInvoice" | "createPayout" | "getPayoutStatus" | "verifyWebhookSignature" | "getInvoiceStatus"
  >;
  webhookId: string | undefined;
  model: () => LanguageModel;
  organizerEmail: string;
  listTables: () => Promise<string[]>;
};

const uuid = z.uuid();

const agentRequest = z.object({
  circleId: z.uuid().optional(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(40),
});

export function createApp(deps: AppDeps): Hono {
  const { store } = deps;
  let agentWindow = { startedAt: Date.now(), calls: 0 };
  const perVisitor = new Map<string, { startedAt: number; calls: number }>();
  const app = new Hono();

  // Anything a route doesn't catch would otherwise be printed in full by Hono's default handler.
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    logError(`${c.req.method} ${c.req.path}`, err);
    return c.json({ error: "Something went wrong" }, 500);
  });
  app.use("*", secureHeaders());
  app.use("/api/*", bodyLimit({ maxSize: MAX_BODY_BYTES }));
  app.use("/webhooks/*", bodyLimit({ maxSize: MAX_BODY_BYTES }));

  app.get("/api/health", async (c) => {
    try {
      return c.json({ ok: true, db: "connected", tables: await deps.listTables() });
    } catch (err) {
      logError("health", err);
      return c.json({ ok: false, db: "unreachable" }, 503);
    }
  });

  app.post("/api/agent", async (c) => {
    const parsed = agentRequest.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Invalid request" }, 400);

    const now = Date.now();
    if (now - agentWindow.startedAt > HOUR_MS) agentWindow = { startedAt: now, calls: 0 };
    const visitorKey = visitor(c.req.header("x-forwarded-for"));
    let mine = perVisitor.get(visitorKey);
    if (!mine || now - mine.startedAt > HOUR_MS) mine = { startedAt: now, calls: 0 };
    if (agentWindow.calls >= AGENT_CALLS_PER_HOUR || mine.calls >= AGENT_CALLS_PER_VISITOR_PER_HOUR) {
      return c.json({ error: "The assistant is busy, try again later" }, 429);
    }
    agentWindow.calls += 1;
    mine.calls += 1;
    perVisitor.set(visitorKey, mine);

    const agentDeps: AgentDeps = {
      store,
      paypal: deps.paypal(),
      organizerEmail: deps.organizerEmail,
      session: { circleId: parsed.data.circleId },
    };

    try {
      const result = await runAgent({
        model: deps.model(),
        deps: agentDeps,
        messages: parsed.data.messages,
        today: new Date().toISOString().slice(0, 10),
      });
      return c.json(result);
    } catch (err) {
      logError("agent", err);
      return c.json({ error: "The assistant could not answer" }, 502);
    }
  });

  app.get("/api/circles/:circleId", async (c) => {
    const circleId = c.req.param("circleId");
    if (!uuid.safeParse(circleId).success) return c.json({ error: "Circle not found" }, 404);

    try {
      await checkReleasingPayouts({ store, paypal: deps.paypal() }, circleId);
    } catch (err) {
      logError("payout status check", err);
    }
    try {
      return c.json(await circleView(store, circleId));
    } catch (err) {
      if (err instanceof Error && err.message.includes("not found")) return c.json({ error: "Circle not found" }, 404);
      logError("circle view", err);
      return c.json({ error: "Could not load the circle" }, 500);
    }
  });

  // The approval gate: the organizer's button, never the model, reaches the payout call.
  app.post("/api/circles/:circleId/payouts/:pendingId/approve", async (c) => {
    const { circleId, pendingId } = c.req.param();
    if (!uuid.safeParse(circleId).success || !uuid.safeParse(pendingId).success) {
      return c.json({ ok: false, reason: "This payout is not waiting for approval" }, 404);
    }

    try {
      const result = await approvePayout({ store, paypal: deps.paypal() }, circleId, pendingId);
      return c.json(result, result.ok ? 200 : 409);
    } catch (err) {
      logError("approve", err);
      return c.json({ ok: false, reason: "Something went wrong; check the activity log before trying again" }, 500);
    }
  });

  app.post("/webhooks/paypal", async (c) => {
    try {
      const result = await handlePayPalWebhook(
        { store, paypal: deps.paypal(), webhookId: deps.webhookId },
        {
          rawBody: await c.req.text(),
          headers: {
            authAlgo: c.req.header("paypal-auth-algo"),
            certUrl: c.req.header("paypal-cert-url"),
            transmissionId: c.req.header("paypal-transmission-id"),
            transmissionSig: c.req.header("paypal-transmission-sig"),
            transmissionTime: c.req.header("paypal-transmission-time"),
          },
        },
      );
      return c.text(result.body, result.status);
    } catch (err) {
      logError("webhook", err);
      return c.text("error", 500);
    }
  });

  return app;
}
