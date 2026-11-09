import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { z } from "zod";
import type { AgentDeps } from "./agent/actions";
import { runAgent } from "./agent/agent";
import { museSparkModel } from "./agent/model";
import { circleView } from "./circle-view";
import { pool } from "./db";
import { PayPalClient } from "./engine/paypal-client";
import { approvePayout, checkReleasingPayouts } from "./payouts/approval";
import { CircleStore } from "./store/circle-store";
import { pgDb } from "./store/db";

const PORT = Number(process.env.PORT ?? 3000);
// serveStatic paths are relative to the working directory, which is apps/api.
const WEB_DIST = "../web/dist";
// The demo URL is public and every agent call spends model credits.
const AGENT_CALLS_PER_HOUR = 60;

const store = new CircleStore(pgDb(pool));
let paypal: PayPalClient | undefined;
const getPayPal = () => (paypal ??= PayPalClient.fromEnv());
let agentWindow = { startedAt: Date.now(), calls: 0 };
const uuid = z.uuid();

const agentRequest = z.object({
  circleId: z.uuid().optional(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(40),
});

const app = new Hono();

app.get("/api/health", async (c) => {
  try {
    const { rows } = await pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    return c.json({ ok: true, db: "connected", tables: rows.map((row) => row.table_name) });
  } catch (err) {
    console.error(err);
    return c.json({ ok: false, db: "unreachable" }, 503);
  }
});

app.post("/api/agent", async (c) => {
  const parsed = agentRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid request" }, 400);

  if (Date.now() - agentWindow.startedAt > 60 * 60 * 1000) agentWindow = { startedAt: Date.now(), calls: 0 };
  if (agentWindow.calls >= AGENT_CALLS_PER_HOUR) return c.json({ error: "The assistant is busy, try again later" }, 429);
  agentWindow.calls += 1;

  const deps: AgentDeps = {
    store,
    paypal: getPayPal(),
    organizerEmail: process.env.ORGANIZER_EMAIL ?? "organizer@altin.example",
    session: { circleId: parsed.data.circleId },
  };

  try {
    const result = await runAgent({
      model: museSparkModel(),
      deps,
      messages: parsed.data.messages,
      today: new Date().toISOString().slice(0, 10),
    });
    return c.json(result);
  } catch (err) {
    console.error(err);
    return c.json({ error: "The assistant could not answer" }, 502);
  }
});

app.get("/api/circles/:circleId", async (c) => {
  const circleId = c.req.param("circleId");
  if (!uuid.safeParse(circleId).success) return c.json({ error: "Circle not found" }, 404);

  try {
    await checkReleasingPayouts({ store, paypal: getPayPal() }, circleId);
  } catch (err) {
    console.error(err);
  }
  try {
    return c.json(await circleView(store, circleId));
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) return c.json({ error: "Circle not found" }, 404);
    console.error(err);
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
    const result = await approvePayout({ store, paypal: getPayPal() }, circleId, pendingId);
    return c.json(result, result.ok ? 200 : 409);
  } catch (err) {
    console.error(err);
    return c.json({ ok: false, reason: "Something went wrong; check the activity log before trying again" }, 500);
  }
});

app.use("/*", serveStatic({ root: WEB_DIST }));
app.get("*", serveStatic({ path: `${WEB_DIST}/index.html` }));

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`altin api listening on port ${info.port}`);
});
