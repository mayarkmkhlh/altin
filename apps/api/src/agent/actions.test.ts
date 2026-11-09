import assert from "node:assert/strict";
import { test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { CircleStore } from "../store/circle-store";
import { testDb } from "../test/test-db";
import {
  type AgentDeps,
  circleSummary,
  createCircleAction,
  proposePayoutAction,
  sendMemberInvoicesAction,
} from "./actions";

function fakePayPal() {
  const created: { requestId: string; recipientEmail: string; amountCents: number }[] = [];
  const sent: string[] = [];
  return {
    created,
    sent,
    client: {
      async createInvoice(input: { requestId: string; recipientEmail: string; amountCents: number }) {
        created.push(input);
        return `INV-${created.length}`;
      },
      async sendInvoice(invoiceId: string) {
        sent.push(invoiceId);
      },
    },
  };
}

async function setup(): Promise<{ db: PGlite; deps: AgentDeps; paypal: ReturnType<typeof fakePayPal> }> {
  const db = await testDb();
  const paypal = fakePayPal();
  const deps: AgentDeps = {
    store: new CircleStore(db),
    paypal: paypal.client,
    organizerEmail: "organizer@example.com",
    session: {},
  };
  return { db, deps, paypal };
}

const sisterFirst = {
  name: "Gold day",
  members: [{ name: "Mariam" }, { name: "Layla" }, { name: "Noor" }],
  startMonth: "2026-12",
  suggestedPledge: { amount: 1000, currency: "SAR" as const },
};

test("create_circle keeps the organizer's rotation order and remembers the circle", async () => {
  const { deps } = await setup();
  const result = await createCircleAction(deps, sisterFirst);

  assert.deepEqual(
    result.rotation.map((turn) => [turn.month, turn.host]),
    [
      ["2026-12", "Mariam"],
      ["2027-01", "Layla"],
      ["2027-02", "Noor"],
    ],
  );
  assert.equal(deps.session.circleId, result.circleId);
});

test("create_circle converts a riyal amount in code, not in the model", async () => {
  const { deps } = await setup();
  const result = await createCircleAction(deps, sisterFirst);

  assert.equal(result.usualPledge?.usd, "266.67");
  assert.equal(result.usualPledge?.sar, "≈ 1000 SAR");
});

test("create_circle refuses to make a second circle in the same conversation", async () => {
  const { db, deps } = await setup();
  await createCircleAction(deps, sisterFirst);

  await assert.rejects(createCircleAction(deps, sisterFirst), /already/);
  const { rows } = await db.query<{ count: number }>("select count(*)::int as count from circles");
  assert.equal(rows[0]!.count, 1);
});

test("the circle summary tells the model what already exists", async () => {
  const { deps } = await setup();
  await createCircleAction(deps, sisterFirst);
  await sendMemberInvoicesAction(deps, { pledges: [{ memberName: "Layla", amount: 300, currency: "USD" }] });

  const summary = await circleSummary(deps);
  assert.match(summary!, /Gold day/);
  assert.match(summary!, /Mariam → Layla → Noor/);
  assert.match(summary!, /Gathering 1 \(host Mariam\): collecting, 0 of 2 invoices paid/);
});

test("there is no summary before a circle exists", async () => {
  const { deps } = await setup();
  assert.equal(await circleSummary(deps), null);
});

test("send_member_invoices invoices everyone except the host, once", async () => {
  const { deps, paypal } = await setup();
  await createCircleAction(deps, sisterFirst);

  const first = await sendMemberInvoicesAction(deps, { pledges: [{ memberName: "layla", amount: 300, currency: "USD" }] });
  assert.deepEqual(
    first.sent.map((s) => [s.member, s.usd, s.source]),
    [
      ["Layla", "300.00", "organizer"],
      ["Noor", "266.67", "usual"],
    ],
  );
  assert.equal(paypal.sent.length, 2);
  assert.match(paypal.created[0]!.requestId, /^altin-.+-m1-.+$/);

  const second = await sendMemberInvoicesAction(deps, { pledges: [] });
  assert.deepEqual(second.sent, []);
  assert.deepEqual(second.alreadyInvoiced, ["Layla", "Noor"]);
  assert.equal(paypal.created.length, 2);
});

test("send_member_invoices refuses a name that isn't in the circle", async () => {
  const { deps, paypal } = await setup();
  await createCircleAction(deps, sisterFirst);

  await assert.rejects(
    sendMemberInvoicesAction(deps, { pledges: [{ memberName: "Fatima", amount: 100, currency: "USD" }] }),
    /Fatima/,
  );
  assert.equal(paypal.created.length, 0);
});

test("without a usual amount, members with no history are reported as needing an amount", async () => {
  const { deps, paypal } = await setup();
  await createCircleAction(deps, { ...sisterFirst, suggestedPledge: undefined });

  const result = await sendMemberInvoicesAction(deps, {});
  assert.deepEqual(result.needsAmount, ["Layla", "Noor"]);
  assert.equal(paypal.created.length, 0);
});

test("send_member_invoices suggests paying back what the host gave at your gathering", async () => {
  const { db, deps } = await setup();
  const { circleId } = await createCircleAction(deps, sisterFirst);
  await sendMemberInvoicesAction(deps, {
    pledges: [
      { memberName: "Layla", amount: 120, currency: "USD" },
      { memberName: "Noor", amount: 80, currency: "USD" },
    ],
  });
  // Month 1 is paid and released; month 2 (Layla hosts) is now collecting.
  await db.query("update invoices set status = 'paid' where circle_id = $1", [circleId]);
  await db.query("update turns set status = 'released' where circle_id = $1 and month_index = 1", [circleId]);
  await db.query("update turns set status = 'collecting' where circle_id = $1 and month_index = 2", [circleId]);

  const result = await sendMemberInvoicesAction(deps, {});
  assert.deepEqual(
    result.sent.map((s) => [s.member, s.usd, s.source]),
    [
      ["Mariam", "120.00", "payback"],
      ["Noor", "266.67", "usual"],
    ],
  );
});

test("propose_payout does nothing while invoices are unpaid", async () => {
  const { db, deps } = await setup();
  await createCircleAction(deps, sisterFirst);
  await sendMemberInvoicesAction(deps, {});

  const result = await proposePayoutAction(deps);
  assert.equal(result.proposed, false);
  const { rows } = await db.query<{ count: number }>("select count(*)::int as count from pending_actions");
  assert.equal(rows[0]!.count, 0);
});

test("propose_payout writes one pending row for the organizer and calls no PayPal method", async () => {
  const { db, deps, paypal } = await setup();
  const { circleId } = await createCircleAction(deps, sisterFirst);
  await sendMemberInvoicesAction(deps, {
    pledges: [
      { memberName: "Layla", amount: 120, currency: "USD" },
      { memberName: "Noor", amount: 80.5, currency: "USD" },
    ],
  });
  await db.query("update invoices set status = 'paid' where circle_id = $1", [circleId]);
  await db.query("update turns set status = 'pot_complete' where circle_id = $1 and month_index = 1", [circleId]);
  const paypalCallsBefore = paypal.created.length + paypal.sent.length;

  const first = await proposePayoutAction(deps);
  const again = await proposePayoutAction(deps);

  assert.equal(first.proposed, true);
  assert.equal(first.proposed && first.usd, "200.50");
  assert.equal(first.proposed && first.host, "Mariam");
  assert.equal(again.proposed && again.alreadyProposed, true);
  assert.equal(paypal.created.length + paypal.sent.length, paypalCallsBefore);

  const { rows } = await db.query<{ kind: string; status: string; amount: number }>(
    "select kind, status, (payload->>'amountCents')::int as amount from pending_actions",
  );
  assert.deepEqual(rows, [{ kind: "payout", status: "pending", amount: 20050 }]);
});
