// A local server with an in-memory database, a seeded circle and a fake PayPal, for building and rehearsing the UI.
// Run from apps/api: npx tsx --env-file=../../.env.local scripts/demo-server.ts   (then `npm run dev:web`)
// The assistant uses the real Muse Spark model when MODEL_API_KEY is set; PayPal is always fake here.
import { serve } from "@hono/node-server";
import { museSparkModel } from "../src/agent/model";
import { createApp } from "../src/app";
import { CircleStore } from "../src/store/circle-store";
import { testDb } from "../src/test/test-db";

const PORT = 3000;
const db = await testDb();
const store = new CircleStore(db);

const names = ["Noura", "Hessa", "Reem", "Huda", "Sara", "Latifa", "Abeer", "Maha", "Dana", "Lama"];
const { circle } = await store.createCircle({
  name: "Al-Noor circle",
  organizerEmail: "organizer@altin.example",
  startMonth: "2026-08",
  suggestedPledgeCents: 20000,
  members: names.map((name) => ({ name, email: `${name.toLowerCase()}@example.com` })),
});
const id = (name: string) => circle.members.find((m) => m.name === name)!.id;

// What each member gave at gatherings 1 to 3, in dollars. Huda gave Hessa $200, so Hessa's payback to Huda is $200.
const past: Record<string, number>[] = [
  { Hessa: 200, Reem: 300, Huda: 150, Sara: 200, Latifa: 180, Abeer: 180, Maha: 120, Dana: 250, Lama: 200 },
  { Noura: 200, Reem: 300, Huda: 200, Sara: 200, Latifa: 180, Abeer: 180, Maha: 150, Dana: 200, Lama: 200 },
  { Noura: 200, Hessa: 200, Huda: 200, Sara: 200, Latifa: 180, Abeer: 200, Maha: 150, Dana: 200, Lama: 200 },
];
const now = Date.now();
const day = 24 * 60 * 60 * 1000;

async function audit(at: number, actor: "agent" | "organizer" | "paypal" | "system", action: string, details: object) {
  await db.query("insert into audit (circle_id, actor, action, details, created_at) values ($1, $2, $3, $4, $5)", [
    circle.id,
    actor,
    action,
    JSON.stringify(details),
    new Date(at).toISOString(),
  ]);
}

await db.query("update audit set created_at = $2 where circle_id = $1", [circle.id, new Date(now - 100 * day).toISOString()]);

for (const [offset, gifts] of past.entries()) {
  const month = offset + 1;
  const start = now - (100 - offset * 30) * day;
  let pot = 0;
  for (const [member, dollars] of Object.entries(gifts)) {
    await store.saveInvoice(circle.id, month, {
      memberId: id(member),
      amountCents: dollars * 100,
      paypalInvoiceId: `INV-DEMO-${month}-${member}`,
      status: "paid",
      amountSource: "organizer",
    });
    await audit(start, "agent", "invoice_sent", { month, member, amountCents: dollars * 100, source: "organizer" });
    await audit(start + 2 * day, "paypal", "invoice_paid", { month, member, amountCents: dollars * 100 });
    pot += dollars * 100;
  }
  await db.query(
    `update turns set status = 'released', payout_amount_cents = $3, sender_batch_id = $4, payout_batch_id = $5, paid_out_at = $6
     where circle_id = $1 and month_index = $2`,
    [circle.id, month, pot, `demo-${month}`, `DEMO-BATCH-${month}`, new Date(start + 5 * day).toISOString()],
  );
  await audit(start + 4 * day, "agent", "payout_proposed", { month, amountCents: pot });
  await audit(start + 4 * day + 60_000, "organizer", "payout_approved", { month, amountCents: pot });
  await audit(start + 5 * day, "paypal", "payout_succeeded", { month, amountCents: pot });
  await audit(start + 5 * day + 1000, "system", "gathering_started", { month: month + 1 });
}

// Gathering 4, host Huda: seven paid, Hessa and Latifa still open.
await db.query("update turns set status = 'collecting' where circle_id = $1 and month_index = 4", [circle.id]);
const current: [string, number, "paid" | "sent", "organizer" | "payback" | "usual"][] = [
  ["Noura", 180, "paid", "organizer"],
  ["Hessa", 200, "sent", "payback"],
  ["Reem", 300, "paid", "organizer"],
  ["Sara", 200, "paid", "organizer"],
  ["Latifa", 180, "sent", "usual"],
  ["Abeer", 180, "paid", "organizer"],
  ["Maha", 120, "paid", "organizer"],
  ["Dana", 260, "paid", "organizer"],
  ["Lama", 200, "paid", "organizer"],
];
for (const [member, dollars, status, source] of current) {
  await store.saveInvoice(circle.id, 4, {
    memberId: id(member),
    amountCents: dollars * 100,
    paypalInvoiceId: `INV-DEMO-4-${member}`,
    status,
    amountSource: source,
  });
  await audit(now - 2 * day, "agent", "invoice_sent", { month: 4, member, amountCents: dollars * 100, source });
  if (status === "paid") {
    await db.query("update invoices set paid_at = $2 where paypal_invoice_id = $1", [
      `INV-DEMO-4-${member}`,
      new Date(now - day).toISOString(),
    ]);
    await audit(now - day, "paypal", "invoice_paid", { month: 4, member, amountCents: dollars * 100 });
  }
}

const payoutStartedAt = new Map<string, number>();
const app = createApp({
  store,
  paypal: () => ({
    async createInvoice(input) {
      return `INV-DEMO-${input.requestId.slice(-8)}`;
    },
    async sendInvoice() {},
    async createPayout() {
      const batch = `DEMO-BATCH-${payoutStartedAt.size + 10}`;
      payoutStartedAt.set(batch, Date.now());
      return batch;
    },
    async getPayoutStatus(batchId) {
      return Date.now() - (payoutStartedAt.get(batchId) ?? 0) > 8000 ? "SUCCESS" : "PENDING";
    },
    async verifyWebhookSignature() {
      return false;
    },
    async getInvoiceStatus() {
      return "sent";
    },
  }),
  webhookId: undefined,
  model: museSparkModel,
  organizerEmail: "organizer@altin.example",
  listTables: async () => ["demo"],
});

// Stands in for the PayPal webhook: the next open invoice of the gathering in progress gets paid.
app.post("/api/dev/pay-next", async (c) => {
  const { rows } = await db.query<{ id: string; turn_id: string; month_index: number; display_name: string; amount_cents: number }>(
    `select i.id, i.turn_id, t.month_index, m.display_name, i.amount_cents
     from invoices i join turns t on t.id = i.turn_id join members m on m.id = i.member_id
     where i.circle_id = $1 and t.status = 'collecting' and i.status = 'sent'
     order by i.created_at limit 1`,
    [circle.id],
  );
  const invoice = rows[0];
  if (!invoice) return c.json({ paid: null });
  await db.query("update invoices set status = 'paid', paid_at = now() where id = $1", [invoice.id]);
  await store.audit(circle.id, "paypal", "invoice_paid", {
    month: invoice.month_index,
    member: invoice.display_name,
    amountCents: invoice.amount_cents,
  });
  const { rows: open } = await db.query("select 1 from invoices where turn_id = $1 and status not in ('paid', 'closed')", [
    invoice.turn_id,
  ]);
  if (open.length === 0) await db.query("update turns set status = 'pot_complete' where id = $1", [invoice.turn_id]);
  return c.json({ paid: invoice.display_name });
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`demo api on http://localhost:${PORT}`);
  console.log(`circle page: http://localhost:5173/circles/${circle.id}`);
});
