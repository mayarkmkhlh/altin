import { approveRelease, type Payout } from "../engine/circle";
import { centsToUsdString } from "../engine/money";
import type { PayPalClient } from "../engine/paypal-client";
import type { CircleStore } from "../store/circle-store";

// Only server code reached from the organizer's Approve button gets these calls; the agent never does.
export type PayoutDeps = {
  store: CircleStore;
  paypal: Pick<PayPalClient, "createPayout" | "getPayoutStatus">;
};

export type ApproveResult =
  | { ok: true; monthIndex: number; usd: string; payoutBatchId: string }
  | { ok: false; reason: string };

export async function approvePayout(deps: PayoutDeps, circleId: string, pendingActionId: string): Promise<ApproveResult> {
  const { store } = deps;
  const claimed = await store.claimPendingPayout(circleId, pendingActionId);
  if (!claimed) return { ok: false, reason: "This payout is not waiting for approval" };

  const { monthIndex, payout: proposed } = claimed;
  await store.audit(circleId, "organizer", "payout_approved", {
    month: monthIndex,
    amountCents: proposed.amountCents,
    receiver: proposed.receiverEmail,
  });

  const refuse = async (reason: string): Promise<ApproveResult> => {
    await store.finishPendingAction(pendingActionId, "failed");
    await store.audit(circleId, "system", "payout_refused", { month: monthIndex, reason });
    return { ok: false, reason };
  };

  // Recompute from the invoices as they are now, so an outdated proposal can never be paid.
  let current: Payout;
  try {
    current = approveRelease((await store.loadCircle(circleId)).circle).payout;
  } catch (err) {
    return refuse(err instanceof Error ? err.message : String(err));
  }
  if (
    current.senderBatchId !== proposed.senderBatchId ||
    current.receiverEmail !== proposed.receiverEmail ||
    current.amountCents !== proposed.amountCents
  ) {
    return refuse("The gathering changed after this payout was proposed. Ask Altın to propose it again.");
  }
  if (!(await store.startRelease(circleId, monthIndex, current))) {
    return refuse(`Gathering ${monthIndex} is no longer waiting for its payout`);
  }

  await store.audit(circleId, "system", "payout_requested", {
    month: monthIndex,
    amountCents: current.amountCents,
    receiver: current.receiverEmail,
    senderBatchId: current.senderBatchId,
  });
  try {
    const payoutBatchId = await deps.paypal.createPayout({
      ...current,
      note: `Your pot for gathering ${monthIndex}, approved by the organizer.`,
    });
    await store.recordPayoutBatch(circleId, monthIndex, payoutBatchId);
    await store.finishPendingAction(pendingActionId, "executed");
    await store.audit(circleId, "paypal", "payout_created", { month: monthIndex, payoutBatchId });
    return { ok: true, monthIndex, usd: centsToUsdString(current.amountCents), payoutBatchId };
  } catch (err) {
    // No automatic retry: PayPal may have accepted it anyway, and the same sender_batch_id keeps a manual retry safe.
    await store.finishPendingAction(pendingActionId, "failed");
    await store.audit(circleId, "paypal", "payout_failed", {
      month: monthIndex,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: "PayPal did not accept the payout. Nothing was retried; see the activity log." };
  }
}

// A gathering counts as paid out only when a GET to PayPal says the batch succeeded.
export async function checkReleasingPayouts(deps: PayoutDeps, circleId: string): Promise<void> {
  for (const { monthIndex, payoutBatchId } of await deps.store.releasingPayouts(circleId)) {
    const status = await deps.paypal.getPayoutStatus(payoutBatchId);
    if (status !== "SUCCESS") continue;

    const { released, nextMonth } = await deps.store.markReleased(circleId, monthIndex);
    if (!released) continue;
    await deps.store.audit(circleId, "paypal", "payout_succeeded", { month: monthIndex, payoutBatchId });
    await deps.store.audit(
      circleId,
      "system",
      nextMonth ? "gathering_started" : "circle_completed",
      nextMonth ? { month: nextMonth } : {},
    );
  }
}
