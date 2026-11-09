import assert from "node:assert/strict";
import { test } from "node:test";
import { PayPalClient } from "./paypal-client";

type Call = { url: string; method: string; headers: Record<string, string>; body?: unknown };

function fakePayPal(responses: Record<string, unknown>, options: { failWith?: [number, string] } = {}) {
  const calls: Call[] = [];
  let clock = 0;

  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    calls.push({ url, method, headers, body });

    const path = new URL(url).pathname;
    if (path === "/v1/oauth2/token") {
      return Response.json({ access_token: `token-${calls.length}`, expires_in: 32400 });
    }
    if (options.failWith) {
      return new Response(options.failWith[1], { status: options.failWith[0] });
    }
    return Response.json(responses[`${method} ${path}`] ?? {});
  };

  const client = new PayPalClient({
    baseUrl: "https://api-m.sandbox.paypal.com",
    clientId: "id",
    clientSecret: "secret",
    fetch,
    now: () => clock,
  });

  return {
    client,
    calls,
    advanceSeconds: (seconds: number) => (clock += seconds * 1000),
    tokenCalls: () => calls.filter((call) => call.url.endsWith("/v1/oauth2/token")).length,
  };
}

test("the token is cached across calls and refreshed just before it expires", async () => {
  const paypal = fakePayPal({ "GET /v2/invoicing/invoices/INV-1": { status: "SENT" } });

  await paypal.client.getInvoiceStatus("INV-1");
  await paypal.client.getInvoiceStatus("INV-1");
  assert.equal(paypal.tokenCalls(), 1);

  paypal.advanceSeconds(32400 - 30);
  await paypal.client.getInvoiceStatus("INV-1");
  assert.equal(paypal.tokenCalls(), 2);
});

test("createInvoice sends the member's own pledge with an idempotency key", async () => {
  const paypal = fakePayPal({ "POST /v2/invoicing/invoices": { id: "INV-9" } });

  const id = await paypal.client.createInvoice({
    requestId: "altin-c1-m1-noor",
    recipientEmail: "noor@example.com",
    amountCents: 1250,
    itemName: "Gathering at Layla's",
  });

  const call = paypal.calls.at(-1)!;
  assert.equal(id, "INV-9");
  assert.equal(call.headers["paypal-request-id"], "altin-c1-m1-noor");
  assert.equal(call.headers.authorization, "Bearer token-1");
  assert.deepEqual((call.body as any).items[0].unit_amount, { currency_code: "USD", value: "12.50" });
  assert.equal((call.body as any).primary_recipients[0].billing_info.email_address, "noor@example.com");
});

test("send, remind and cancel hit the right invoice endpoints", async () => {
  const paypal = fakePayPal({});

  await paypal.client.sendInvoice("INV-1");
  await paypal.client.remindInvoice("INV-1", { subject: "Reminder", note: "Gentle reminder" });
  await paypal.client.cancelInvoice("INV-1", "Closed by the organizer");

  assert.deepEqual(
    paypal.calls.slice(1).map((call) => `${call.method} ${new URL(call.url).pathname}`),
    [
      "POST /v2/invoicing/invoices/INV-1/send",
      "POST /v2/invoicing/invoices/INV-1/remind",
      "POST /v2/invoicing/invoices/INV-1/cancel",
    ],
  );
});

test("PayPal invoice statuses map onto the engine's statuses", async () => {
  const cases: [string, string][] = [
    ["DRAFT", "draft"],
    ["SENT", "sent"],
    ["UNPAID", "sent"],
    ["PAYMENT_PENDING", "sent"],
    ["PARTIALLY_PAID", "partially_paid"],
    ["PAID", "paid"],
    ["CANCELLED", "closed"],
    ["MARKED_AS_PAID", "sent"],
  ];
  for (const [paypalStatus, expected] of cases) {
    const paypal = fakePayPal({ "GET /v2/invoicing/invoices/INV-1": { status: paypalStatus } });
    assert.equal(await paypal.client.getInvoiceStatus("INV-1"), expected, paypalStatus);
  }
});

test("createPayout uses the business-event sender_batch_id and the summed amount", async () => {
  const paypal = fakePayPal({
    "POST /v1/payments/payouts": { batch_header: { payout_batch_id: "BATCH-1", batch_status: "PENDING" } },
  });

  const batchId = await paypal.client.createPayout({
    senderBatchId: "altin-c1-m1-layla",
    receiverEmail: "layla@example.com",
    amountCents: 5005,
    note: "Your gathering pot",
  });

  const body = paypal.calls.at(-1)!.body as any;
  assert.equal(batchId, "BATCH-1");
  assert.equal(body.sender_batch_header.sender_batch_id, "altin-c1-m1-layla");
  assert.deepEqual(body.items[0].amount, { value: "50.05", currency: "USD" });
  assert.equal(body.items[0].receiver, "layla@example.com");
});

test("errors include PayPal's status and message", async () => {
  const paypal = fakePayPal({}, { failWith: [403, '{"name":"NOT_AUTHORIZED"}'] });
  await assert.rejects(paypal.client.sendInvoice("INV-1"), /403.*NOT_AUTHORIZED/);
});
