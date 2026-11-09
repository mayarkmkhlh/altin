import assert from "node:assert/strict";
import { test } from "node:test";
import { testDb } from "../test/test-db";
import { CircleStore } from "./circle-store";

const newCircle = {
  name: "Gold day",
  organizerEmail: "organizer@example.com",
  startMonth: "2026-12",
  suggestedPledgeCents: 26667,
  members: [
    { name: "Mariam", email: "mariam@example.com" },
    { name: "Layla", email: "layla@example.com" },
    { name: "Noor", email: "noor@example.com" },
  ],
};

test("a created circle loads back with its rotation in order", async () => {
  const store = new CircleStore(await testDb());
  const created = await store.createCircle(newCircle);
  const loaded = await store.loadCircle(created.circle.id);

  assert.equal(loaded.name, "Gold day");
  assert.equal(loaded.startMonth, "2026-12");
  assert.equal(loaded.suggestedPledgeCents, 26667);
  assert.equal(loaded.circle.status, "active");
  assert.deepEqual(
    loaded.circle.turns.map((turn) => [turn.monthIndex, loaded.circle.members.find((m) => m.id === turn.hostId)!.name, turn.status]),
    [
      [1, "Mariam", "collecting"],
      [2, "Layla", "upcoming"],
      [3, "Noor", "upcoming"],
    ],
  );
});

test("each gathering is due one month after the previous one", async () => {
  const db = await testDb();
  const store = new CircleStore(db);
  const { circle } = await store.createCircle(newCircle);

  const { rows } = await db.query<{ due: string }>(
    "select to_char(due_date, 'YYYY-MM') as due from turns where circle_id = $1 order by month_index",
    [circle.id],
  );
  assert.deepEqual(rows.map((row) => row.due), ["2026-12", "2027-01", "2027-02"]);
});

test("a circle with fewer than two members is rejected before anything is written", async () => {
  const db = await testDb();
  const store = new CircleStore(db);

  await assert.rejects(store.createCircle({ ...newCircle, members: [newCircle.members[0]!] }), /at least 2 members/);
  const { rows } = await db.query<{ count: number }>("select count(*)::int as count from circles");
  assert.equal(rows[0]!.count, 0);
});

test("saving the same invoice twice keeps one row", async () => {
  const store = new CircleStore(await testDb());
  const { circle } = await store.createCircle(newCircle);
  const layla = circle.members[1]!;
  const invoice = { memberId: layla.id, amountCents: 5000, paypalInvoiceId: "INV-1", status: "sent" as const };

  await store.saveInvoice(circle.id, 1, invoice);
  await store.saveInvoice(circle.id, 1, invoice);

  const loaded = await store.loadCircle(circle.id);
  assert.deepEqual(loaded.circle.turns[0]!.invoices, [{ memberId: layla.id, amountCents: 5000, status: "sent" }]);
});

test("a pending payout is created once per business event", async () => {
  const store = new CircleStore(await testDb());
  const { circle } = await store.createCircle(newCircle);
  const payout = { senderBatchId: `altin-${circle.id}-m1-x`, receiverEmail: "mariam@example.com", amountCents: 10000 };

  const first = await store.createPendingPayout(circle.id, 1, payout);
  const second = await store.createPendingPayout(circle.id, 1, payout);

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.id, first.id);
});
