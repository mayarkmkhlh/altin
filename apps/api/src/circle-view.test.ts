import assert from "node:assert/strict";
import { test } from "node:test";
import { circleView } from "./circle-view";
import { maskEmail } from "./redact";
import { approveRelease } from "./engine/circle";
import { CircleStore } from "./store/circle-store";
import { testDb } from "./test/test-db";

async function secondGathering() {
  const db = await testDb();
  const store = new CircleStore(db);
  const { circle } = await store.createCircle({
    name: "Al-Noor",
    organizerEmail: "organizer@example.com",
    startMonth: "2026-12",
    suggestedPledgeCents: 20000,
    members: [
      { name: "Hessa", email: "hessa@example.com" },
      { name: "Huda", email: "huda@example.com" },
      { name: "Latifa", email: "latifa@example.com" },
    ],
  });
  const [hessa, huda, latifa] = circle.members;
  await store.saveInvoice(circle.id, 1, { memberId: huda!.id, amountCents: 25000, paypalInvoiceId: "INV-1", status: "paid", amountSource: "organizer" });
  await store.saveInvoice(circle.id, 1, { memberId: latifa!.id, amountCents: 18000, paypalInvoiceId: "INV-2", status: "paid", amountSource: "organizer" });
  await db.query("update turns set status = 'released' where circle_id = $1 and month_index = 1", [circle.id]);
  await db.query("update turns set status = 'collecting' where circle_id = $1 and month_index = 2", [circle.id]);
  await store.saveInvoice(circle.id, 2, { memberId: hessa!.id, amountCents: 25000, paypalInvoiceId: "INV-3", status: "sent", amountSource: "payback" });
  return { db, store, circleId: circle.id, latifaId: latifa!.id };
}

test("the view shows the gathering in progress with each invoice's amount source", async () => {
  const { store, circleId } = await secondGathering();

  const view = await circleView(store, circleId);

  assert.deepEqual(
    view.gatherings.map((g) => [g.index, g.month, g.host, g.status, g.potCents]),
    [
      [1, "2026-12", "Hessa", "released", 43000],
      [2, "2027-01", "Huda", "collecting", 0],
      [3, "2027-02", "Latifa", "upcoming", 0],
    ],
  );
  assert.equal(view.current?.host, "Huda");
  assert.deepEqual(
    view.current?.invoices.map((i) => [i.member, i.amountCents, i.status, i.amountSource]),
    [["Hessa", 25000, "sent", "payback"]],
  );
  assert.deepEqual(view.current?.notInvoiced.map((m) => m.member), ["Latifa"]);
  assert.equal(view.current?.pledgedCents, 25000);
});

test("a pending payout lists who gave what and masks the host's email", async () => {
  const { db, store, circleId, latifaId } = await secondGathering();
  await store.saveInvoice(circleId, 2, { memberId: latifaId, amountCents: 15000, paypalInvoiceId: "INV-4", status: "paid" });
  await db.query("update invoices set status = 'paid' where paypal_invoice_id = 'INV-3'");
  await db.query("update turns set status = 'pot_complete' where circle_id = $1 and month_index = 2", [circleId]);
  const { circle } = await store.loadCircle(circleId);
  await store.createPendingPayout(circleId, 2, approveRelease(circle).payout);

  const [pending] = (await circleView(store, circleId)).pendingPayouts;

  assert.equal(pending?.host, "Huda");
  assert.equal(pending?.amountCents, 40000);
  assert.equal(pending?.receiverEmail, "h•••@example.com");
  assert.deepEqual(pending?.contributions, [
    { member: "Hessa", amountCents: 25000 },
    { member: "Latifa", amountCents: 15000 },
  ]);
});

test("maskEmail keeps the first letter and the domain", () => {
  assert.equal(maskEmail("sb-pqh9w53471606@personal.example.com"), "s•••@personal.example.com");
});
