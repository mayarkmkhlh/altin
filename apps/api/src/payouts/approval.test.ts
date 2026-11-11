import assert from "node:assert/strict";
import { test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { createTools } from "../agent/agent";
import { approveRelease } from "../engine/circle";
import { CircleStore } from "../store/circle-store";
import { testDb } from "../test/test-db";
import { approvePayout, checkReleasingPayouts } from "./approval";

function fakePayPal() {
  const payouts: { senderBatchId: string; receiverEmail: string; amountCents: number }[] = [];
  const state = { batchStatus: "PENDING", fail: false };
  return {
    payouts,
    state,
    client: {
      async createPayout(input: { senderBatchId: string; receiverEmail: string; amountCents: number; note: string }) {
        payouts.push({ senderBatchId: input.senderBatchId, receiverEmail: input.receiverEmail, amountCents: input.amountCents });
        if (state.fail) throw new Error("PayPal POST /v1/payments/payouts failed: 422");
        return `BATCH-${payouts.length}`;
      },
      async getPayoutStatus() {
        return state.batchStatus;
      },
    },
  };
}

// A circle whose first gathering is fully paid, with the agent's proposal waiting for approval.
async function proposedPayout() {
  const db = await testDb();
  const store = new CircleStore(db);
  const paypal = fakePayPal();
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
  await store.saveInvoice(circle.id, 1, { memberId: layla!.id, amountCents: 26667, paypalInvoiceId: "INV-1", status: "paid" });
  await store.saveInvoice(circle.id, 1, { memberId: noor!.id, amountCents: 13333, paypalInvoiceId: "INV-2", status: "paid" });
  await db.query("update turns set status = 'pot_complete' where circle_id = $1 and month_index = 1", [circle.id]);

  const { circle: ready } = await store.loadCircle(circle.id);
  const pending = await store.createPendingPayout(circle.id, 1, approveRelease(ready).payout);
  return { db, store, paypal, deps: { store, paypal: paypal.client }, circleId: circle.id, pendingId: pending.id };
}

async function auditActions(db: PGlite, circleId: string): Promise<string[]> {
  const { rows } = await db.query<{ actor: string; action: string }>(
    "select actor, action from audit where circle_id = $1 order by id",
    [circleId],
  );
  return rows.map((row) => `${row.actor}:${row.action}`);
}

async function turnStatuses(db: PGlite, circleId: string): Promise<string[]> {
  const { rows } = await db.query<{ status: string }>(
    "select status from turns where circle_id = $1 order by month_index",
    [circleId],
  );
  return rows.map((row) => row.status);
}

test("the agent's tools cannot release money", () => {
  const tools = createTools({} as never);
  assert.deepEqual(Object.keys(tools).sort(), ["create_circle", "propose_payout", "send_member_invoices"]);
});

test("approving makes exactly one payout call for the proposed amount and logs each step", async () => {
  const { db, deps, paypal, circleId, pendingId } = await proposedPayout();

  const result = await approvePayout(deps, circleId, pendingId);

  assert.equal(result.ok, true);
  assert.deepEqual(paypal.payouts, [
    { senderBatchId: paypal.payouts[0]!.senderBatchId, receiverEmail: "mariam@example.com", amountCents: 40000 },
  ]);
  assert.match(paypal.payouts[0]!.senderBatchId, new RegExp(`^altin-${circleId}-m1-`));
  assert.deepEqual(await turnStatuses(db, circleId), ["releasing", "upcoming", "upcoming"]);

  const { rows } = await db.query<{ status: string }>("select status from pending_actions where id = $1", [pendingId]);
  assert.equal(rows[0]!.status, "executed");
  assert.deepEqual((await auditActions(db, circleId)).slice(-3), [
    "organizer:payout_approved",
    "system:payout_requested",
    "paypal:payout_created",
  ]);
});

test("a second approval does nothing", async () => {
  const { deps, paypal, circleId, pendingId } = await proposedPayout();

  await approvePayout(deps, circleId, pendingId);
  const again = await approvePayout(deps, circleId, pendingId);

  assert.equal(again.ok, false);
  assert.equal(paypal.payouts.length, 1);
});

test("a double tap pays once", async () => {
  const { deps, paypal, circleId, pendingId } = await proposedPayout();

  const results = await Promise.all([approvePayout(deps, circleId, pendingId), approvePayout(deps, circleId, pendingId)]);

  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(paypal.payouts.length, 1);
});

test("a proposal that no longer matches the paid invoices is refused, not paid", async () => {
  const { db, deps, paypal, circleId, pendingId } = await proposedPayout();
  await db.query("update invoices set amount_cents = 20000 where paypal_invoice_id = 'INV-2'");

  const result = await approvePayout(deps, circleId, pendingId);

  assert.equal(result.ok, false);
  assert.equal(paypal.payouts.length, 0);
  assert.deepEqual(await turnStatuses(db, circleId), ["pot_complete", "upcoming", "upcoming"]);
  assert.equal((await auditActions(db, circleId)).at(-1), "system:payout_refused");
});

test("an approval from another circle's page is refused", async () => {
  const first = await proposedPayout();
  const { circle: other } = await first.store.createCircle({
    name: "Other",
    organizerEmail: "someone@example.com",
    startMonth: "2027-01",
    suggestedPledgeCents: null,
    members: [
      { name: "A", email: "a@example.com" },
      { name: "B", email: "b@example.com" },
    ],
  });

  const result = await approvePayout(first.deps, other.id, first.pendingId);

  assert.equal(result.ok, false);
  assert.equal(first.paypal.payouts.length, 0);
});

test("a PayPal error is logged and not retried", async () => {
  const { db, deps, paypal, circleId, pendingId } = await proposedPayout();
  paypal.state.fail = true;

  const result = await approvePayout(deps, circleId, pendingId);

  assert.equal(result.ok, false);
  assert.equal(paypal.payouts.length, 1);
  const { rows } = await db.query<{ status: string }>("select status from pending_actions where id = $1", [pendingId]);
  assert.equal(rows[0]!.status, "failed");
  assert.equal((await auditActions(db, circleId)).at(-1), "paypal:payout_failed");
});

test("the gathering is released only once PayPal reports the batch as SUCCESS", async () => {
  const { db, deps, paypal, circleId, pendingId } = await proposedPayout();
  await approvePayout(deps, circleId, pendingId);

  await checkReleasingPayouts(deps, circleId);
  assert.deepEqual(await turnStatuses(db, circleId), ["releasing", "upcoming", "upcoming"]);

  paypal.state.batchStatus = "SUCCESS";
  await checkReleasingPayouts(deps, circleId);
  await checkReleasingPayouts(deps, circleId);

  assert.deepEqual(await turnStatuses(db, circleId), ["released", "collecting", "upcoming"]);
  const actions = await auditActions(db, circleId);
  assert.equal(actions.filter((action) => action === "paypal:payout_succeeded").length, 1);
  const { rows } = await db.query<{ details: { amountCents: number } }>(
    "select details from audit where circle_id = $1 and action = 'payout_succeeded'",
    [circleId],
  );
  assert.equal(rows[0]!.details.amountCents, paypal.payouts[0]!.amountCents);
});

test("releasing the last gathering completes the circle", async () => {
  const { db, deps, paypal, circleId, pendingId } = await proposedPayout();
  await db.query("update turns set status = 'released' where circle_id = $1 and month_index > 1", [circleId]);
  await approvePayout(deps, circleId, pendingId);

  paypal.state.batchStatus = "SUCCESS";
  await checkReleasingPayouts(deps, circleId);

  const { rows } = await db.query<{ status: string }>("select status from circles where id = $1", [circleId]);
  assert.equal(rows[0]!.status, "completed");
});
