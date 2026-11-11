import { addMonths } from "./engine/calendar";
import { currentTurn, potTotalCents } from "./engine/circle";
import type { CircleStore } from "./store/circle-store";

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}•••@${domain}`;
}

// Everything the organizer's screens show, read from stored facts only. Amounts are integer US cents.
export async function circleView(store: CircleStore, circleId: string) {
  const record = await store.loadCircle(circleId);
  const { circle } = record;
  const nameOf = (id: string) => circle.members.find((m) => m.id === id)?.name ?? "?";
  const details = await store.listInvoiceDetails(circleId);

  const gatherings = circle.turns.map((turn) => ({
    index: turn.monthIndex,
    month: addMonths(record.startMonth, turn.monthIndex - 1),
    hostId: turn.hostId,
    host: nameOf(turn.hostId),
    status: turn.status,
    potCents: potTotalCents(turn),
    paidCount: turn.invoices.filter((invoice) => invoice.status === "paid").length,
    invoiceCount: turn.invoices.length,
  }));

  const turn = currentTurn(circle);
  const current = turn
    ? (() => {
        const invoices = details
          .filter((invoice) => invoice.monthIndex === turn.monthIndex)
          .map((invoice) => ({
            memberId: invoice.memberId,
            member: nameOf(invoice.memberId),
            amountCents: invoice.amountCents,
            status: invoice.status,
            amountSource: invoice.amountSource,
            paidAt: invoice.paidAt,
          }));
        return {
          ...gatherings.find((g) => g.index === turn.monthIndex)!,
          pledgedCents: invoices.filter((i) => i.status !== "closed").reduce((sum, i) => sum + i.amountCents, 0),
          closedCount: invoices.filter((i) => i.status === "closed").length,
          invoices,
          notInvoiced: circle.members
            .filter((m) => m.id !== turn.hostId && !invoices.some((i) => i.memberId === m.id))
            .map((m) => ({ memberId: m.id, member: m.name })),
        };
      })()
    : null;

  const pendingPayouts = (await store.listPendingPayouts(circleId)).map((pending) => {
    const paid = details.filter((i) => i.monthIndex === pending.monthIndex && i.status === "paid");
    const host = circle.members.find((m) => m.email === pending.payout.receiverEmail);
    return {
      id: pending.id,
      index: pending.monthIndex,
      host: host?.name ?? "?",
      receiverEmail: maskEmail(pending.payout.receiverEmail),
      amountCents: pending.payout.amountCents,
      proposedAt: pending.proposedAt,
      contributions: paid.map((i) => ({ member: nameOf(i.memberId), amountCents: i.amountCents })),
      closedCount: details.filter((i) => i.monthIndex === pending.monthIndex && i.status === "closed").length,
    };
  });

  return {
    id: circle.id,
    name: record.name,
    status: circle.status,
    startMonth: record.startMonth,
    suggestedPledgeCents: record.suggestedPledgeCents,
    members: circle.members.map((m, index) => ({ id: m.id, name: m.name, position: index + 1 })),
    gatherings,
    current,
    pendingPayouts,
    activity: await store.listAudit(circleId),
  };
}

export type CircleView = Awaited<ReturnType<typeof circleView>>;
