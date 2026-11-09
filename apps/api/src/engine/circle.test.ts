import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addInvoice,
  addMember,
  approveRelease,
  type Circle,
  closeInvoice,
  createCircle,
  currentTurn,
  markReleased,
  potTotalCents,
  setInvoiceStatus,
  startCircle,
} from "./circle";

const layla = { id: "layla", name: "Layla", email: "layla@example.com" };
const noor = { id: "noor", name: "Noor", email: "noor@example.com" };
const sara = { id: "sara", name: "Sara", email: "sara@example.com" };

function activeCircle(): Circle {
  let circle = createCircle("c1");
  for (const member of [layla, noor, sara]) circle = addMember(circle, member);
  return startCircle(circle);
}

function payAll(circle: Circle, pledges: Record<string, number>): Circle {
  for (const [memberId, cents] of Object.entries(pledges)) circle = addInvoice(circle, memberId, cents);
  for (const memberId of Object.keys(pledges)) circle = setInvoiceStatus(circle, memberId, "paid");
  return circle;
}

test("starting builds the rotation: month 1 collecting, the rest upcoming", () => {
  const circle = activeCircle();
  assert.equal(circle.status, "active");
  assert.deepEqual(
    circle.turns.map((turn) => [turn.monthIndex, turn.hostId, turn.status]),
    [
      [1, "layla", "collecting"],
      [2, "noor", "upcoming"],
      [3, "sara", "upcoming"],
    ],
  );
});

test("a circle needs at least two members to start", () => {
  assert.throws(() => startCircle(addMember(createCircle("c1"), layla)), /at least 2 members/);
});

test("members can only join while the circle is forming", () => {
  assert.throws(() => addMember(activeCircle(), { id: "dina", name: "Dina", email: "dina@example.com" }), /forming/);
});

test("variable pledges sum correctly into the payout", () => {
  let circle = addInvoice(activeCircle(), "noor", 1250);
  circle = addInvoice(circle, "sara", 3755);
  circle = setInvoiceStatus(circle, "noor", "paid");
  circle = setInvoiceStatus(circle, "sara", "paid");

  assert.equal(currentTurn(circle)!.status, "pot_complete");
  assert.equal(potTotalCents(currentTurn(circle)!), 5005);

  const { payout } = approveRelease(circle);
  assert.equal(payout.amountCents, 5005);
  assert.equal(payout.receiverEmail, "layla@example.com");
});

test("an unpaid invoice blocks completion", () => {
  let circle = addInvoice(activeCircle(), "noor", 1000);
  circle = addInvoice(circle, "sara", 2000);
  circle = setInvoiceStatus(circle, "noor", "paid");
  circle = setInvoiceStatus(circle, "sara", "sent");

  assert.equal(currentTurn(circle)!.status, "collecting");
  assert.throws(() => approveRelease(circle), /pot_complete/);
});

test("a partially paid invoice blocks completion", () => {
  let circle = addInvoice(activeCircle(), "noor", 1000);
  circle = addInvoice(circle, "sara", 2000);
  circle = setInvoiceStatus(circle, "noor", "paid");
  circle = setInvoiceStatus(circle, "sara", "partially_paid");

  assert.equal(currentTurn(circle)!.status, "collecting");
});

test("closing an unpaid invoice removes it from the total and can complete the pot", () => {
  let circle = addInvoice(activeCircle(), "noor", 1000);
  circle = addInvoice(circle, "sara", 2000);
  circle = setInvoiceStatus(circle, "noor", "paid");
  assert.equal(currentTurn(circle)!.status, "collecting");

  circle = closeInvoice(circle, "sara");
  assert.equal(currentTurn(circle)!.status, "pot_complete");
  assert.equal(potTotalCents(currentTurn(circle)!), 1000);
});

test("a pot where every invoice is closed is not complete", () => {
  let circle = addInvoice(activeCircle(), "noor", 1000);
  circle = closeInvoice(circle, "noor");
  assert.equal(currentTurn(circle)!.status, "collecting");
});

test("a paid invoice cannot be closed", () => {
  let circle = addInvoice(activeCircle(), "noor", 1000);
  circle = addInvoice(circle, "sara", 1000);
  circle = setInvoiceStatus(circle, "noor", "paid");
  assert.throws(() => closeInvoice(circle, "noor"), /paid/);
});

test("the host does not invoice herself, and each member gets one invoice per gathering", () => {
  const circle = addInvoice(activeCircle(), "noor", 1000);
  assert.throws(() => addInvoice(circle, "layla", 1000), /host/);
  assert.throws(() => addInvoice(circle, "noor", 500), /already/);
});

test("pledges must be positive whole cents", () => {
  assert.throws(() => addInvoice(activeCircle(), "noor", 0));
  assert.throws(() => addInvoice(activeCircle(), "noor", 12.5));
});

test("release needs a complete pot, and the batch id comes from the business event", () => {
  const circle = payAll(activeCircle(), { noor: 1000, sara: 2000 });
  const first = approveRelease(circle);
  const again = approveRelease(circle);

  assert.equal(first.circle.turns[0]!.status, "releasing");
  assert.equal(first.payout.senderBatchId, "altin-c1-m1-layla");
  assert.equal(again.payout.senderBatchId, first.payout.senderBatchId);
  assert.throws(() => approveRelease(first.circle), /pot_complete/);
});

test("a confirmed release moves the circle to the next month", () => {
  const released = markReleased(approveRelease(payAll(activeCircle(), { noor: 1000, sara: 2000 })).circle);

  assert.deepEqual(
    released.turns.map((turn) => turn.status),
    ["released", "collecting", "upcoming"],
  );
  assert.equal(currentTurn(released)!.hostId, "noor");
});

test("the last release completes the circle", () => {
  let circle = activeCircle();
  const gatherings: Record<string, number>[] = [
    { noor: 100, sara: 100 },
    { layla: 100, sara: 100 },
    { layla: 100, noor: 100 },
  ];
  for (const pledges of gatherings) {
    circle = markReleased(approveRelease(payAll(circle, pledges)).circle);
  }
  assert.equal(circle.status, "completed");
  assert.equal(currentTurn(circle), undefined);
});

test("markReleased only works while a payout is releasing", () => {
  assert.throws(() => markReleased(activeCircle()), /releasing/);
});
