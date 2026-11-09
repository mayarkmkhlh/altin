import { useCallback, useEffect, useState } from "react";

type Gathering = { month: number; host: string; status: string; paidInvoices: number; invoices: number; potUsd: string };
type PendingPayout = { id: string; month: number; host: string; usd: string; sar: string };
type Activity = { id: number; actor: string; action: string; details: Record<string, unknown>; at: string };
type CircleView = {
  id: string;
  name: string;
  status: string;
  gatherings: Gathering[];
  pendingPayouts: PendingPayout[];
  activity: Activity[];
};

const STATUS_LABELS: Record<string, string> = {
  upcoming: "Upcoming",
  collecting: "Collecting",
  pot_complete: "Pot complete",
  releasing: "Paying out",
  released: "Paid out",
};

const ACTOR_LABELS: Record<string, string> = {
  agent: "Altın AI",
  organizer: "You",
  paypal: "PayPal",
  system: "Altın server",
};

const usd = (cents: unknown) => `$${(Number(cents) / 100).toFixed(2)}`;

function describe(entry: Activity): string {
  const d = entry.details;
  switch (entry.action) {
    case "circle_created":
      return `Created the circle with ${d.members} members`;
    case "invoice_sent":
      return `Sent ${d.member} a PayPal invoice for ${usd(d.amountCents)} (gathering ${d.month})`;
    case "payout_proposed":
      return `Proposed releasing ${usd(d.amountCents)} for gathering ${d.month}. Waiting for your approval`;
    case "tool_failed":
      return `Tried ${d.tool} and was stopped: ${d.error}`;
    case "payout_approved":
      return `Approved the ${usd(d.amountCents)} payout for gathering ${d.month}`;
    case "payout_refused":
      return `Refused the payout for gathering ${d.month}: ${d.reason}`;
    case "payout_requested":
      return `Asked PayPal to pay ${usd(d.amountCents)} to ${d.receiver}`;
    case "payout_created":
      return `Accepted the payout (batch ${d.payoutBatchId})`;
    case "payout_failed":
      return `Rejected the payout: ${d.error}`;
    case "payout_succeeded":
      return `Confirmed the payout for gathering ${d.month} succeeded`;
    case "gathering_started":
      return `Gathering ${d.month} is now collecting`;
    case "circle_completed":
      return "Every gathering is paid out. The circle is complete";
    default:
      return entry.action;
  }
}

export function CirclePage({ circleId }: { circleId: string }) {
  const [view, setView] = useState<CircleView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/circles/${circleId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setView(body as CircleView);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [circleId]);

  useEffect(() => {
    void load();
  }, [load]);

  // While a payout is in flight, keep asking until PayPal confirms it.
  const paying = view?.gatherings.some((g) => g.status === "releasing") ?? false;
  useEffect(() => {
    if (!paying) return;
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [paying, load]);

  async function approve(payout: PendingPayout) {
    setApproving(payout.id);
    setNotice(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/payouts/${payout.id}/approve`, { method: "POST" });
      const body = (await res.json()) as { ok: boolean; reason?: string };
      setNotice(
        body.ok ? `PayPal accepted the payout to ${payout.host}. Waiting for PayPal to confirm it.` : (body.reason ?? "Not approved"),
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setApproving(null);
      await load();
    }
  }

  if (error) return <p>Could not load this circle: {error}</p>;
  if (!view) return <p>Loading the circle…</p>;

  return (
    <>
      <h1>{view.name}</h1>
      {view.status === "completed" && <p>This circle is complete.</p>}

      {view.pendingPayouts.map((payout) => (
        <section key={payout.id} style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>Release the pot to {payout.host}?</h2>
          <p style={{ fontSize: 28, margin: "8px 0" }}>
            ${payout.usd} <span style={{ fontSize: 16, color: "#666" }}>{payout.sar}</span>
          </p>
          <p>
            Every invoice for gathering {payout.month} is paid. Altın's AI prepared this payout but cannot send it.
            Nothing moves until you approve. Approving sends a PayPal sandbox payout right away.
          </p>
          <button
            type="button"
            onClick={() => void approve(payout)}
            disabled={approving !== null}
            style={buttonStyle}
          >
            {approving === payout.id ? "Sending…" : `Approve ${payout.usd} USD to ${payout.host}`}
          </button>
        </section>
      ))}
      {notice && <p role="status">{notice}</p>}

      <h2>Gatherings</h2>
      <ol style={{ paddingInlineStart: 20 }}>
        {view.gatherings.map((g) => (
          <li key={g.month}>
            {g.host}: {STATUS_LABELS[g.status] ?? g.status}
            {g.invoices > 0 && ` · ${g.paidInvoices} of ${g.invoices} paid · $${g.potUsd} collected`}
          </li>
        ))}
      </ol>

      <h2>Activity</h2>
      <p style={{ color: "#666" }}>Everything Altın's AI, the server and PayPal did in this circle, newest first.</p>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {view.activity.map((entry) => (
          <li key={entry.id} style={{ borderTop: "1px solid #eee", padding: "8px 0" }}>
            <strong>{ACTOR_LABELS[entry.actor] ?? entry.actor}</strong> {describe(entry)}
            <div style={{ color: "#888", fontSize: 13 }}>{new Date(entry.at).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </>
  );
}

const cardStyle = { border: "2px solid #c9a227", borderRadius: 12, padding: 20, background: "#fffaf0" };
const buttonStyle = {
  background: "#c9a227",
  color: "#1a1a1a",
  border: "none",
  borderRadius: 8,
  padding: "12px 20px",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
};
