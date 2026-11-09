import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addInvoice,
  addMember,
  approveRelease,
  type Circle,
  createCircle,
  markReleased,
  setInvoiceStatus,
  startCircle,
} from "./circle";
import { memberBalances, paybackSuggestion } from "./ledger";

function gathering(circle: Circle, pledges: Record<string, number>): Circle {
  for (const [memberId, cents] of Object.entries(pledges)) circle = addInvoice(circle, memberId, cents);
  for (const memberId of Object.keys(pledges)) circle = setInvoiceStatus(circle, memberId, "paid");
  return markReleased(approveRelease(circle).circle);
}

function threeMemberCircle(): Circle {
  let circle = createCircle("c1");
  for (const id of ["layla", "noor", "sara"]) {
    circle = addMember(circle, { id, name: id, email: `${id}@example.com` });
  }
  return startCircle(circle);
}

test("payback suggestion is what the host gave at the giver's own gathering", () => {
  // Month 1, Layla hosts: Noor gives 30, Sara gives 50.
  const circle = gathering(threeMemberCircle(), { noor: 3000, sara: 5000 });

  // Month 2, Noor hosts. Layla is about to give: Noor gave Layla 30, so suggest 30.
  assert.equal(paybackSuggestion(circle, "layla", "noor"), 3000);
  // Sara never hosted, so there is nothing to pay back yet.
  assert.equal(paybackSuggestion(circle, "sara", "noor"), null);
});

test("payback suggestion ignores what the host gave to other members", () => {
  // Month 1, Layla hosts: Noor gives 30. Month 2, Noor hosts: Layla 40, Sara 25.
  let circle = gathering(threeMemberCircle(), { noor: 3000, sara: 1000 });
  circle = gathering(circle, { layla: 4000, sara: 2500 });

  // Month 3, Sara hosts. Layla is giving: Sara gave Layla 10 in month 1, not Noor's 30 or 25.
  assert.equal(paybackSuggestion(circle, "layla", "sara"), 1000);
  // Noor is giving: Sara gave Noor 25 in month 2.
  assert.equal(paybackSuggestion(circle, "noor", "sara"), 2500);
});

test("unpaid or closed invoices are not used as payback history", () => {
  let circle = addInvoice(threeMemberCircle(), "noor", 3000);
  circle = addInvoice(circle, "sara", 5000);
  circle = setInvoiceStatus(circle, "sara", "paid");

  assert.equal(paybackSuggestion(circle, "layla", "noor"), null);
});

test("balances: paid in, received and net come from the same ledger", () => {
  // Month 1, Layla hosts: Noor 30 + Sara 50 = 80 to Layla.
  const circle = gathering(threeMemberCircle(), { noor: 3000, sara: 5000 });

  assert.deepEqual(memberBalances(circle), [
    { memberId: "layla", paidInCents: 0, receivedCents: 8000, netCents: 8000 },
    { memberId: "noor", paidInCents: 3000, receivedCents: 0, netCents: -3000 },
    { memberId: "sara", paidInCents: 5000, receivedCents: 0, netCents: -5000 },
  ]);
});

test("a pot that is approved but not yet released is not counted as received", () => {
  let circle = addInvoice(threeMemberCircle(), "noor", 3000);
  circle = setInvoiceStatus(circle, "noor", "paid");
  circle = approveRelease(circle).circle;

  const layla = memberBalances(circle).find((balance) => balance.memberId === "layla")!;
  assert.equal(layla.receivedCents, 0);
});
