import { potTotalCents } from "./engine/circle";
import { centsToUsdString, sarLabel } from "./engine/money";
import type { CircleStore } from "./store/circle-store";

// Everything the organizer's circle page shows: the rotation, the payouts waiting for her, and the activity log.
export async function circleView(store: CircleStore, circleId: string) {
  const record = await store.loadCircle(circleId);
  const { circle } = record;
  const memberName = (id: string) => circle.members.find((m) => m.id === id)?.name ?? "Unknown";
  const nameByEmail = (email: string) => circle.members.find((m) => m.email === email)?.name ?? email;

  return {
    id: circle.id,
    name: record.name,
    status: circle.status,
    gatherings: circle.turns.map((turn) => ({
      month: turn.monthIndex,
      host: memberName(turn.hostId),
      status: turn.status,
      paidInvoices: turn.invoices.filter((invoice) => invoice.status === "paid").length,
      invoices: turn.invoices.length,
      potUsd: centsToUsdString(potTotalCents(turn)),
    })),
    pendingPayouts: (await store.listPendingPayouts(circleId)).map((pending) => ({
      id: pending.id,
      month: pending.monthIndex,
      host: nameByEmail(pending.payout.receiverEmail),
      usd: centsToUsdString(pending.payout.amountCents),
      sar: sarLabel(pending.payout.amountCents),
    })),
    activity: await store.listAudit(circleId),
  };
}
