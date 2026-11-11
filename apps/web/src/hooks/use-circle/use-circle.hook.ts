import { useCallback, useEffect, useState } from "react";
import { getJson, HttpError } from "../../lib/http/http";
import type { CircleView } from "../../lib/types/circle-view.type";

const PAYING_POLL_MS = 5000;

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
      setState(error instanceof HttpError && error.status === 404 ? { status: "missing" } : { status: "error" });
    }
  }, [circleId]);

  useEffect(() => {
    setState(circleId ? { status: "loading" } : { status: "none" });
    void refresh();
  }, [circleId, refresh]);

  // A payout is only final when PayPal confirms it, so keep asking while one is in flight.
  const paying = state.status === "ready" && state.circle.gatherings.some((g) => g.status === "releasing");
  useEffect(() => {
    if (!paying) return;
    const timer = setInterval(() => void refresh(), PAYING_POLL_MS);
    return () => clearInterval(timer);
  }, [paying, refresh]);

  return { state, refresh };
}
