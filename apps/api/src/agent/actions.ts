import { z } from "zod";
import { addMonths } from "../engine/calendar";
import { addInvoice, approveRelease, currentTurn, potTotalCents } from "../engine/circle";
import { paybackSuggestion } from "../engine/ledger";
import { centsToUsdString, sarLabel, toUsdCents } from "../engine/money";
import type { PayPalClient } from "../engine/paypal-client";
import type { AmountSource, CircleStore } from "../store/circle-store";

export type AgentDeps = {
  store: CircleStore;
  // Invoices only. The agent is never handed the payout calls (business rule 1).
  paypal: Pick<PayPalClient, "createInvoice" | "sendInvoice">;
  organizerEmail: string;
  session: { circleId?: string };
};

const spokenAmount = z.object({
  amount: z.number().positive().describe("The number exactly as the organizer said it"),
  currency: z.enum(["USD", "SAR"]).describe("SAR if she said riyals, otherwise USD"),
});

export const createCircleInput = z.object({
  name: z.string().min(1).max(80).describe("A short name for the circle"),
  members: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        email: z.email().optional().describe("Only if the organizer gave it"),
      }),
    )
    .min(2)
    .max(30)
    .describe("In rotation order: the first member hosts the first gathering"),
  startMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).describe("YYYY-MM of the first gathering"),
  suggestedPledge: spokenAmount
    .optional()
    .describe("The usual amount she mentioned, if any. Only a default; each member still gives what she chooses"),
});

export const sendMemberInvoicesInput = z.object({
  pledges: z
    .array(spokenAmount.extend({ memberName: z.string().min(1) }))
    .optional()
    .describe("Amounts the organizer stated for specific members this gathering"),
});

export async function createCircleAction(deps: AgentDeps, input: z.infer<typeof createCircleInput>) {
  if (deps.session.circleId) {
    throw new Error("This conversation already has a circle. Start a new conversation to create another one.");
  }
  const suggestedPledgeCents = input.suggestedPledge
    ? toUsdCents(input.suggestedPledge.amount, input.suggestedPledge.currency)
    : null;

  const { circle, startMonth } = await deps.store.createCircle({
    name: input.name,
    organizerEmail: deps.organizerEmail,
    startMonth: input.startMonth,
    suggestedPledgeCents,
    members: input.members.map((member, index) => ({
      name: member.name,
      email: member.email ?? `member-${index + 1}@altin.example`,
    })),
  });
  deps.session.circleId = circle.id;

  return {
    circleId: circle.id,
    rotation: circle.turns.map((turn) => ({
      month: addMonths(startMonth, turn.monthIndex - 1),
      host: circle.members.find((m) => m.id === turn.hostId)!.name,
    })),
    usualPledge: suggestedPledgeCents
      ? { usd: centsToUsdString(suggestedPledgeCents), sar: sarLabel(suggestedPledgeCents) }
      : null,
  };
}

export async function sendMemberInvoicesAction(deps: AgentDeps, input: z.infer<typeof sendMemberInvoicesInput>) {
  const circleId = requireCircleId(deps);
  const record = await deps.store.loadCircle(circleId);
  const turn = currentTurn(record.circle);
  if (!turn || turn.status !== "collecting") {
    throw new Error("There is no gathering collecting money right now");
  }
  const members = record.circle.members;
  const host = members.find((m) => m.id === turn.hostId)!;

  const stated = new Map<string, number>();
  for (const pledge of input.pledges ?? []) {
    const member = members.find((m) => normalize(m.name) === normalize(pledge.memberName));
    if (!member) throw new Error(`No member named ${pledge.memberName} in this circle`);
    stated.set(member.id, toUsdCents(pledge.amount, pledge.currency));
  }

  let circle = record.circle;
  const plan: { memberId: string; name: string; email: string; amountCents: number; source: AmountSource }[] = [];
  const alreadyInvoiced: string[] = [];
  const needsAmount: string[] = [];

  for (const member of members) {
    if (member.id === host.id) continue;
    if (turn.invoices.some((invoice) => invoice.memberId === member.id)) {
      alreadyInvoiced.push(member.name);
      continue;
    }
    const payback = paybackSuggestion(circle, member.id, host.id);
    const [amountCents, source]: [number, AmountSource] | [null, null] = stated.has(member.id)
      ? [stated.get(member.id)!, "organizer"]
      : payback !== null
        ? [payback, "payback"]
        : record.suggestedPledgeCents !== null
          ? [record.suggestedPledgeCents, "usual"]
          : [null, null];
    if (amountCents === null) {
      needsAmount.push(member.name);
      continue;
    }
    circle = addInvoice(circle, member.id, amountCents);
    plan.push({ memberId: member.id, name: member.name, email: member.email, amountCents, source: source! });
  }

  for (const item of plan) {
    const invoiceId = await deps.paypal.createInvoice({
      requestId: `altin-${circleId}-m${turn.monthIndex}-${item.memberId}`,
      recipientEmail: item.email,
      amountCents: item.amountCents,
      itemName: `${record.name}: ${host.name}'s gathering`,
      note: "Give what you choose. You can change the amount with the organizer.",
    });
    await deps.paypal.sendInvoice(invoiceId);
    await deps.store.saveInvoice(circleId, turn.monthIndex, {
      memberId: item.memberId,
      amountCents: item.amountCents,
      paypalInvoiceId: invoiceId,
      status: "sent",
      amountSource: item.source,
    });
    await deps.store.audit(circleId, "agent", "invoice_sent", {
      month: turn.monthIndex,
      member: item.name,
      amountCents: item.amountCents,
      source: item.source,
      paypalInvoiceId: invoiceId,
    });
  }

  return {
    gathering: turn.monthIndex,
    host: host.name,
    sent: plan.map((item) => ({
      member: item.name,
      usd: centsToUsdString(item.amountCents),
      sar: sarLabel(item.amountCents),
      source: item.source,
    })),
    alreadyInvoiced,
    needsAmount,
  };
}

// Writes a pending row for the organizer's approve button. It never calls PayPal.
export async function proposePayoutAction(deps: AgentDeps) {
  const circleId = requireCircleId(deps);
  const { circle } = await deps.store.loadCircle(circleId);
  const turn = currentTurn(circle);
  if (!turn) throw new Error("There is no gathering in progress");
  const host = circle.members.find((m) => m.id === turn.hostId)!;

  if (turn.status !== "pot_complete") {
    const paid = turn.invoices.filter((invoice) => invoice.status === "paid").length;
    return {
      proposed: false as const,
      reason: `Gathering ${turn.monthIndex} is ${turn.status}: ${paid} of ${turn.invoices.length} invoices paid`,
      paidSoFarUsd: centsToUsdString(potTotalCents(turn)),
    };
  }

  const { payout } = approveRelease(circle);
  const pending = await deps.store.createPendingPayout(circleId, turn.monthIndex, payout);
  if (pending.created) {
    await deps.store.audit(circleId, "agent", "payout_proposed", { month: turn.monthIndex, amountCents: payout.amountCents });
  }

  return {
    proposed: true as const,
    alreadyProposed: !pending.created,
    pendingActionId: pending.id,
    host: host.name,
    usd: centsToUsdString(payout.amountCents),
    sar: sarLabel(payout.amountCents),
    nextStep: "Waiting for the organizer to press Approve. Nothing has been paid.",
  };
}

// The chat history only carries text replies, so each turn tells the model what already exists.
export async function circleSummary(deps: AgentDeps): Promise<string | null> {
  if (!deps.session.circleId) return null;
  const record = await deps.store.loadCircle(deps.session.circleId);
  const { circle } = record;
  const nameOf = (id: string) => circle.members.find((m) => m.id === id)!.name;

  const lines = [
    `Current circle: ${record.name} (already created; do not create it again)`,
    `Rotation: ${circle.turns.map((turn) => nameOf(turn.hostId)).join(" → ")}`,
    `Usual amount: ${
      record.suggestedPledgeCents
        ? `${centsToUsdString(record.suggestedPledgeCents)} USD (${sarLabel(record.suggestedPledgeCents)})`
        : "none"
    }`,
  ];
  const turn = currentTurn(circle);
  if (turn) {
    const paid = turn.invoices.filter((invoice) => invoice.status === "paid").length;
    lines.push(
      `Gathering ${turn.monthIndex} (host ${nameOf(turn.hostId)}): ${turn.status}, ${paid} of ${turn.invoices.length} invoices paid`,
    );
  } else {
    lines.push("All gatherings are done.");
  }
  return lines.join("\n");
}

function requireCircleId(deps: AgentDeps): string {
  if (!deps.session.circleId) throw new Error("No circle yet. Create the circle first.");
  return deps.session.circleId;
}

function normalize(name: string): string {
  return name.trim().toLocaleLowerCase();
}
