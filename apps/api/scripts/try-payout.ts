// Sends one real PayPal sandbox payout through the approval gate, with an in-memory database so Neon is untouched.
// Run from apps/api: npx tsx --env-file=../../../paypal-spike/.env scripts/try-payout.ts
import { type AgentDeps, proposePayoutAction } from "../src/agent/actions";
import { PayPalClient } from "../src/engine/paypal-client";
import { approvePayout, checkReleasingPayouts } from "../src/payouts/approval";
import { CircleStore } from "../src/store/circle-store";
import { testDb } from "../src/test/test-db";

const HOST_EMAIL = process.env.PAYOUT_TEST_RECEIVER ?? "sb-pqh9w53471606@personal.example.com";

const db = await testDb();
const store = new CircleStore(db);
const paypal = PayPalClient.fromEnv();

const { circle } = await store.createCircle({
  name: "Gate test",
  organizerEmail: "organizer@altin.example",
  startMonth: "2026-12",
  suggestedPledgeCents: null,
  members: [
    { name: "Mariam", email: HOST_EMAIL },
    { name: "Layla", email: "member-2@altin.example" },
    { name: "Noor", email: "member-3@altin.example" },
  ],
});
const [, layla, noor] = circle.members;
await store.saveInvoice(circle.id, 1, { memberId: layla!.id, amountCents: 500, paypalInvoiceId: "INV-TEST-1", status: "paid" });
await store.saveInvoice(circle.id, 1, { memberId: noor!.id, amountCents: 700, paypalInvoiceId: "INV-TEST-2", status: "paid" });
await db.query("update turns set status = 'pot_complete' where circle_id = $1 and month_index = 1", [circle.id]);

const agentDeps: AgentDeps = {
  store,
  paypal: {
    createInvoice: async () => {
      throw new Error("not used");
    },
    sendInvoice: async () => {},
  },
  organizerEmail: "organizer@altin.example",
  session: { circleId: circle.id },
};
const proposal = await proposePayoutAction(agentDeps);
if (!proposal.proposed) throw new Error(proposal.reason);
console.log(`agent proposed: $${proposal.usd} to ${proposal.host}`);

const deps = { store, paypal };
console.log("first approve:", await approvePayout(deps, circle.id, proposal.pendingActionId));
console.log("second approve:", await approvePayout(deps, circle.id, proposal.pendingActionId));

for (let attempt = 1; attempt <= 24; attempt++) {
  await checkReleasingPayouts(deps, circle.id);
  const { rows } = await db.query<{ status: string }>(
    "select status from turns where circle_id = $1 and month_index = 1",
    [circle.id],
  );
  console.log(`check ${attempt}: gathering 1 is ${rows[0]!.status}`);
  if (rows[0]!.status === "released") break;
  await new Promise((resolve) => setTimeout(resolve, 5000));
}

console.log("\naudit log:");
for (const entry of (await store.listAudit(circle.id)).reverse()) {
  console.log(`  ${entry.actor.padEnd(9)} ${entry.action.padEnd(18)} ${JSON.stringify(entry.details)}`);
}
