import assert from "node:assert/strict";
import { test } from "node:test";
import type { InvoiceStatus } from "../engine/circle";
import { PayPalClient } from "../engine/paypal-client";
import { CircleStore } from "../store/circle-store";
import { testDb } from "../test/test-db";
import { handlePayPalWebhook } from "./paypal-webhook";

const headers = {
  authAlgo: "SHA256withRSA",
  certUrl: "https://api.sandbox.paypal.com/v1/notifications/certs/CERT-1",
  transmissionId: "tx-1",
  transmissionSig: "sig",
  transmissionTime: "2026-11-11T13:00:00Z",
};

const paidEvent = (eventId: string, invoiceId: string) =>
  JSON.stringify({
    id: eventId,
    event_type: "INVOICING.INVOICE.PAID",
    resource: { invoice: { id: invoiceId, status: "PAID" } },
  });

// Gathering 1 of a three-person circle: Layla and Noor each have a sent invoice.
async function collecting() {
  const db = await testDb();
  const store = new CircleStore(db);
  const { circle } = await store.createCircle({
    name: "Gold day",
    organizerEmail: "organizer@example.com",
    startMonth: "2026-12",
    suggestedPledgeCents: null,
    members: [
      { name: "Mariam", email: "mariam@example.com" },
      { name: "Layla", email: "layla@example.com" },
      { name: "Noor", email: "noor@example.com" },
    ],
  });
  const [, layla, noor] = circle.members;
  await store.saveInvoice(circle.id, 1, { memberId: layla!.id, amountCents: 20000, paypalInvoiceId: "INV-1", status: "sent" });
  await store.saveInvoice(circle.id, 1, { memberId: noor!.id, amountCents: 15000, paypalInvoiceId: "INV-2", status: "sent" });

  const paypal = { signatureValid: true, status: "paid" as InvoiceStatus };
  const deps = {
    store,
    webhookId: "WH-1",
    paypal: {
      async verifyWebhookSignature() {
        return paypal.signatureValid;
      },
      async getInvoiceStatus() {
        return paypal.status;
      },
    },
  };
  const deliver = (rawBody: string) => handlePayPalWebhook(deps, { headers, rawBody });

  const invoiceStatuses = async () =>
    (await db.query<{ status: string }>("select status from invoices where circle_id = $1 order by paypal_invoice_id", [circle.id]))
      .rows.map((row) => row.status);
  const gatheringStatus = async () =>
    (await db.query<{ status: string }>("select status from turns where circle_id = $1 and month_index = 1", [circle.id])).rows[0]!
      .status;
  const paidRows = async () =>
    (await db.query("select 1 from audit where circle_id = $1 and action = 'invoice_paid'", [circle.id])).rows.length;

  return { paypal, deliver, invoiceStatuses, gatheringStatus, paidRows };
}

test("a verified PAID event marks that member paid and logs it", async () => {
  const { deliver, invoiceStatuses, gatheringStatus, paidRows } = await collecting();

  const result = await deliver(paidEvent("WH-EVT-1", "INV-1"));

  assert.deepEqual(result, { status: 200, body: "paid" });
  assert.deepEqual(await invoiceStatuses(), ["paid", "sent"]);
  assert.equal(await gatheringStatus(), "collecting");
  assert.equal(await paidRows(), 1);
});

test("the last payment completes the pot", async () => {
  const { deliver, gatheringStatus } = await collecting();

  await deliver(paidEvent("WH-EVT-1", "INV-1"));
  await deliver(paidEvent("WH-EVT-2", "INV-2"));

  assert.equal(await gatheringStatus(), "pot_complete");
});

test("a repeat delivery of the same event does nothing", async () => {
  const { deliver, invoiceStatuses, paidRows } = await collecting();

  await deliver(paidEvent("WH-EVT-1", "INV-1"));
  const again = await deliver(paidEvent("WH-EVT-1", "INV-1"));

  assert.deepEqual(again, { status: 200, body: "duplicate" });
  assert.deepEqual(await invoiceStatuses(), ["paid", "sent"]);
  assert.equal(await paidRows(), 1);
});

test("an event that fails signature verification changes nothing", async () => {
  const { paypal, deliver, invoiceStatuses, paidRows } = await collecting();
  paypal.signatureValid = false;

  const result = await deliver(paidEvent("WH-EVT-1", "INV-1"));

  assert.equal(result.status, 400);
  assert.deepEqual(await invoiceStatuses(), ["sent", "sent"]);
  assert.equal(await paidRows(), 0);
});

test("if PayPal's GET doesn't say PAID, the event is refused so PayPal redelivers it", async () => {
  const { paypal, deliver, invoiceStatuses } = await collecting();
  paypal.status = "sent";

  const first = await deliver(paidEvent("WH-EVT-1", "INV-1"));
  assert.equal(first.status, 500);
  assert.deepEqual(await invoiceStatuses(), ["sent", "sent"]);

  paypal.status = "paid";
  const retry = await deliver(paidEvent("WH-EVT-1", "INV-1"));
  assert.deepEqual(retry, { status: 200, body: "paid" });
});

test("missing signature headers are rejected before calling PayPal", async () => {
  const { store } = { store: new CircleStore(await testDb()) };
  let called = false;
  const result = await handlePayPalWebhook(
    {
      store,
      webhookId: "WH-1",
      paypal: {
        async verifyWebhookSignature() {
          called = true;
          return true;
        },
        async getInvoiceStatus() {
          return "paid";
        },
      },
    },
    { headers: {}, rawBody: paidEvent("WH-EVT-1", "INV-1") },
  );
  assert.equal(result.status, 400);
  assert.equal(called, false);
});

test("the event is sent to verify-webhook-signature exactly as received", async () => {
  const rawBody = '{"id":"WH-EVT-1",  "event_type":"INVOICING.INVOICE.PAID","resource":{"amount":"200.00"}}';
  let sent = "";
  const client = new PayPalClient({
    baseUrl: "https://paypal.test",
    clientId: "id",
    clientSecret: "secret",
    fetch: (async (url: string, init: RequestInit) => {
      if (url.endsWith("/v1/oauth2/token")) return Response.json({ access_token: "t", expires_in: 3600 });
      sent = init.body as string;
      return Response.json({ verification_status: "SUCCESS" });
    }) as typeof fetch,
  });

  assert.equal(await client.verifyWebhookSignature({ webhookId: "WH-1", headers, rawBody }), true);
  assert.ok(sent.endsWith(`"webhook_id":"WH-1","webhook_event":${rawBody}}`));
  assert.equal(JSON.parse(sent).transmission_id, "tx-1");
});
