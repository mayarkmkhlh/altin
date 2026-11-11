import { CircleStore, type AmountSource } from "../src/store/circle-store";
import type { Db } from "../src/store/db";

// The demo story, shared by the local demo server and the Neon seed: the Al-Noor circle, ten fictional women,
// three gatherings already paid out, and gathering 4 (host Huda) waiting on one last payment from Hessa.
const NAMES = ["Noura", "Hessa", "Reem", "Huda", "Sara", "Latifa", "Abeer", "Maha", "Dana", "Lama"] as const;
type Name = (typeof NAMES)[number];

// What each member gave at gatherings 1 to 3, in dollars. Huda gave Hessa $200, so Hessa's payback to Huda is $200.
const PAST: Partial<Record<Name, number>>[] = [
  { Hessa: 200, Reem: 300, Huda: 150, Sara: 200, Latifa: 180, Abeer: 180, Maha: 120, Dana: 250, Lama: 200 },
  { Noura: 200, Reem: 300, Huda: 200, Sara: 200, Latifa: 180, Abeer: 180, Maha: 150, Dana: 200, Lama: 200 },
  { Noura: 200, Hessa: 200, Huda: 200, Sara: 200, Latifa: 180, Abeer: 200, Maha: 150, Dana: 200, Lama: 200 },
];

const CURRENT: [Name, number, AmountSource][] = [
  ["Noura", 180, "organizer"],
  ["Hessa", 200, "payback"],
  ["Reem", 300, "organizer"],
  ["Sara", 200, "organizer"],
  ["Latifa", 200, "usual"],
  ["Abeer", 180, "organizer"],
  ["Maha", 120, "organizer"],
  ["Dana", 260, "organizer"],
  ["Lama", 200, "organizer"],
];

const DAY = 24 * 60 * 60 * 1000;

export type DemoSeedOptions = {
  organizerEmail: string;
  // Real sandbox addresses for the members the demo touches live; everyone else gets an example.com address.
  emails?: Partial<Record<Name, string>>;
  // Sends Hessa's real invoice and returns PayPal's id; without it the invoice is fake and the dev endpoint pays it.
  sendOpenInvoice?: (input: { email: string; amountCents: number; requestId: string }) => Promise<string>;
  now?: number;
};

export async function seedDemoCircle(db: Db, options: DemoSeedOptions): Promise<{ circleId: string; openInvoiceId: string }> {
  const store = new CircleStore(db);
  const now = options.now ?? Date.now();
  const email = (name: Name) => options.emails?.[name] ?? `${name.toLowerCase()}@example.com`;

  const { circle } = await store.createCircle({
    name: "Al-Noor circle",
    organizerEmail: options.organizerEmail,
    startMonth: "2026-08",
    suggestedPledgeCents: 20000,
    members: NAMES.map((name) => ({ name, email: email(name) })),
  });
  const id = (name: Name) => circle.members.find((m) => m.name === name)!.id;

  const audit = (at: number, actor: "agent" | "organizer" | "paypal" | "system", action: string, details: object) =>
    db.query("insert into audit (circle_id, actor, action, details, created_at) values ($1, $2, $3, $4, $5)", [
      circle.id,
      actor,
      action,
      JSON.stringify(details),
      new Date(at).toISOString(),
    ]);

  await db.query("update audit set created_at = $2 where circle_id = $1", [circle.id, new Date(now - 100 * DAY).toISOString()]);

  for (const [offset, gifts] of PAST.entries()) {
    const month = offset + 1;
    const start = now - (100 - offset * 30) * DAY;
    let pot = 0;
    for (const [member, dollars] of Object.entries(gifts) as [Name, number][]) {
      await store.saveInvoice(circle.id, month, {
        memberId: id(member),
        amountCents: dollars * 100,
        paypalInvoiceId: `INV-DEMO-${circle.id.slice(0, 8)}-${month}-${member}`,
        status: "paid",
        amountSource: "organizer",
      });
      await audit(start, "agent", "invoice_sent", { month, member, amountCents: dollars * 100, source: "organizer" });
      await audit(start + 2 * DAY, "paypal", "invoice_paid", { month, member, amountCents: dollars * 100 });
      pot += dollars * 100;
    }
    await db.query(
      `update turns set status = 'released', payout_amount_cents = $3, sender_batch_id = $4, payout_batch_id = $5, paid_out_at = $6
       where circle_id = $1 and month_index = $2`,
      [circle.id, month, pot, `demo-${circle.id}-${month}`, `DEMO-BATCH-${circle.id}-${month}`, new Date(start + 5 * DAY).toISOString()],
    );
    await audit(start + 4 * DAY, "agent", "payout_proposed", { month, amountCents: pot });
    await audit(start + 4 * DAY + 60_000, "organizer", "payout_approved", { month, amountCents: pot });
    await audit(start + 5 * DAY, "paypal", "payout_succeeded", { month, amountCents: pot });
    await audit(start + 5 * DAY + 1000, "system", "gathering_started", { month: month + 1 });
  }

  await db.query("update turns set status = 'collecting' where circle_id = $1 and month_index = 4", [circle.id]);
  let openInvoiceId = "";
  for (const [member, dollars, source] of CURRENT) {
    const open = member === "Hessa";
    const paypalInvoiceId =
      open && options.sendOpenInvoice
        ? await options.sendOpenInvoice({ email: email(member), amountCents: dollars * 100, requestId: `demo-${circle.id}-4-${member}` })
        : `INV-DEMO-${circle.id.slice(0, 8)}-4-${member}`;
    if (open) openInvoiceId = paypalInvoiceId;

    await store.saveInvoice(circle.id, 4, {
      memberId: id(member),
      amountCents: dollars * 100,
      paypalInvoiceId,
      status: open ? "sent" : "paid",
      amountSource: source,
    });
    await audit(now - 2 * DAY, "agent", "invoice_sent", { month: 4, member, amountCents: dollars * 100, source });
    if (!open) {
      await db.query("update invoices set paid_at = $2 where paypal_invoice_id = $1", [paypalInvoiceId, new Date(now - DAY).toISOString()]);
      await audit(now - DAY, "paypal", "invoice_paid", { month: 4, member, amountCents: dollars * 100 });
    }
  }

  return { circleId: circle.id, openInvoiceId };
}
