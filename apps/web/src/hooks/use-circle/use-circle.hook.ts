import { useCallback, useEffect, useState } from "react";
import { getJson, HttpError } from "../../lib/http/http";
import type { CircleView } from "../../lib/types/circle-view.type";

const PAYING_POLL_MS = 5000;
const PAYMENTS_POLL_MS = 10_000;

export type CircleState =
  | { status: "none" }
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; circle: CircleView };

export function useCircle(circleId: string | null): { state: CircleState; refresh: () => Promise<void> } {
  const [state, setState] = useState<CircleState>(circleId ? { status: "loading" } : { status: "none" });

  const refresh = useCallback(async () => {
    if (!circleId) return setState({ status: "none" });
    try {
      setState({ status: "ready", circle: await getJson<CircleView>(`/api/circles/${circleId}`) });
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return setState({ status: "missing" });
      // A background refresh that fails keeps the board it already has; only a first load shows the error.
      setState((previous) => (previous.status === "ready" ? previous : { status: "error" }));
    }
  }, [circleId]);

  useEffect(() => {
    setState(circleId ? { status: "loading" } : { status: "none" });
    void refresh();
  }, [circleId, refresh]);

  // A payout is only final when PayPal confirms it, so keep asking while one is in flight.
  // Payments arrive by webhook on the server, so the board also checks in while invoices are still open.
  const gatherings = state.status === "ready" ? state.circle.gatherings : [];
  const paying = gatherings.some((g) => g.status === "releasing");
  const awaitingPayments = gatherings.some((g) => g.status === "collecting" && g.paidCount < g.invoiceCount);
  const pollMs = paying ? PAYING_POLL_MS : awaitingPayments ? PAYMENTS_POLL_MS : null;
  useEffect(() => {
    if (pollMs === null) return;
    const timer = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(timer);
  }, [pollMs, refresh]);

  return { state, refresh };
}
