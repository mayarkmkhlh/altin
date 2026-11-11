import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "./app";
import { circleView } from "./circle-view";
import { logError, redactEmails } from "./redact";
import { CircleStore } from "./store/circle-store";
import { testDb } from "./test/test-db";

async function app() {
  const store = new CircleStore(await testDb());
  return {
    store,
    app: createApp({
      store,
      paypal: () => ({}) as never,
      webhookId: "WH-1",
      model: () => {
        throw new Error("no model in tests");
      },
      organizerEmail: "organizer@example.com",
      listTables: async () => [],
    }),
  };
}

const ask = (handler: Awaited<ReturnType<typeof app>>["app"], ip: string) =>
  handler.request("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
  });

test("one visitor is limited to 20 assistant calls an hour, without blocking others", async () => {
  const { app: handler } = await app();
  for (let i = 0; i < 20; i++) assert.notEqual((await ask(handler, "203.0.113.7")).status, 429);

  assert.equal((await ask(handler, "203.0.113.7")).status, 429);
  assert.notEqual((await ask(handler, "198.51.100.2")).status, 429);
});

test("a spoofed X-Forwarded-For prefix doesn't buy a fresh allowance", async () => {
  const { app: handler } = await app();
  for (let i = 0; i < 20; i++) await ask(handler, `10.0.0.${i}, 203.0.113.7`);

  assert.equal((await ask(handler, "10.9.9.9, 203.0.113.7")).status, 429);
});

test("oversized request bodies are refused", async () => {
  const { app: handler } = await app();
  const res = await handler.request("/webhooks/paypal", { method: "POST", body: "x".repeat(200 * 1024) });
  assert.equal(res.status, 413);
});

test("an uncaught error answers a generic 500 and logs only a masked line", async () => {
  const store = new CircleStore(await testDb());
  const handler = createApp({
    store,
    paypal: () => {
      throw new Error("token for organizer@example.com expired");
    },
    webhookId: "WH-1",
    model: () => ({}) as never,
    organizerEmail: "organizer@example.com",
    listTables: async () => [],
  });
  const lines: string[] = [];
  const original = console.error;
  console.error = (line: string) => lines.push(line);
  let res: Response;
  try {
    res = await handler.request("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
  } finally {
    console.error = original;
  }
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), { error: "Something went wrong" });
  assert.deepEqual(lines, ["POST /api/agent: Error: token for o•••@example.com expired"]);
});

test("responses carry security headers", async () => {
  const { app: handler } = await app();
  const res = await handler.request("/api/health");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
});

test("the public activity feed masks every email", async () => {
  const { store } = await app();
  const { circle } = await store.createCircle({
    name: "Gold day",
    organizerEmail: "organizer@example.com",
    startMonth: "2026-12",
    suggestedPledgeCents: null,
    members: [
      { name: "Mariam", email: "mariam@example.com" },
      { name: "Layla", email: "layla@example.com" },
    ],
  });
  await store.audit(circle.id, "organizer", "payout_approved", { month: 1, receiver: "mariam@example.com" });
  await store.audit(circle.id, "paypal", "payout_failed", { month: 1, error: "422 receiver mariam@example.com is invalid" });

  const view = JSON.stringify(await circleView(store, circle.id));
  assert.ok(!view.includes("mariam@example.com"));
  assert.ok(view.includes("m•••@example.com"));
});

test("logged errors are masked and never include the request they carried", () => {
  const lines: string[] = [];
  const original = console.error;
  console.error = (line: string) => lines.push(line);
  try {
    const err = Object.assign(new Error("PayPal POST failed: receiver layla@example.com"), {
      requestBodyValues: { messages: [{ content: "Layla's email is layla@example.com" }] },
    });
    logError("approve", err);
  } finally {
    console.error = original;
  }
  assert.deepEqual(lines, ["approve: Error: PayPal POST failed: receiver l•••@example.com"]);
  assert.equal(redactEmails("no emails here"), "no emails here");
});
