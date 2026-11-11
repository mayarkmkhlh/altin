import { assertCents } from "./money";

export type Member = { id: string; name: string; email: string };

export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "closed";
export type Invoice = { memberId: string; amountCents: number; status: InvoiceStatus };

export type Payout = { senderBatchId: string; receiverEmail: string; amountCents: number };

export type TurnStatus = "upcoming" | "collecting" | "pot_complete" | "releasing" | "released";
export type Turn = {
  monthIndex: number;
  hostId: string;
  status: TurnStatus;
  invoices: Invoice[];
  payout?: Payout;
};

export type CircleStatus = "forming" | "active" | "completed";
export type Circle = { id: string; status: CircleStatus; members: Member[]; turns: Turn[] };

const FINAL_INVOICE_STATUSES: InvoiceStatus[] = ["paid", "closed"];
const LIVE_TURN_STATUSES: TurnStatus[] = ["collecting", "pot_complete", "releasing"];

export class CircleError extends Error {}

export function createCircle(id: string): Circle {
  return { id, status: "forming", members: [], turns: [] };
}

export function addMember(circle: Circle, member: Member): Circle {
  if (circle.status !== "forming") throw new CircleError("Members can only join while the circle is forming");
  if (circle.members.some((m) => m.id === member.id || m.email === member.email)) {
    throw new CircleError(`${member.name} is already in the circle`);
  }
  return { ...circle, members: [...circle.members, member] };
}

export function startCircle(circle: Circle): Circle {
  if (circle.status !== "forming") throw new CircleError("Only a forming circle can start");
  if (circle.members.length < 2) throw new CircleError("A circle needs at least 2 members");

  const turns: Turn[] = circle.members.map((member, index) => ({
    monthIndex: index + 1,
    hostId: member.id,
    status: index === 0 ? "collecting" : "upcoming",
    invoices: [],
  }));
  return { ...circle, status: "active", turns };
}

export function currentTurn(circle: Circle): Turn | undefined {
  return circle.turns.find((turn) => LIVE_TURN_STATUSES.includes(turn.status));
}

export function potTotalCents(turn: Turn): number {
  return turn.invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + invoice.amountCents, 0);
}

export function isPotComplete(turn: Turn): boolean {
  return (
    turn.invoices.every((invoice) => FINAL_INVOICE_STATUSES.includes(invoice.status)) &&
    turn.invoices.some((invoice) => invoice.status === "paid")
  );
}

// A misheard "100000" must never become an invoice; real circles give a few hundred dollars a month.
export const MAX_INVOICE_CENTS = 300_000;

export function addInvoice(circle: Circle, memberId: string, amountCents: number): Circle {
  assertCents(amountCents);
  if (amountCents > MAX_INVOICE_CENTS) {
    throw new CircleError(`One invoice can be at most $${MAX_INVOICE_CENTS / 100}; check the amount with the organizer`);
  }
  const turn = requireTurn(circle, "collecting");
  if (!circle.members.some((m) => m.id === memberId)) throw new CircleError(`Unknown member ${memberId}`);
  if (memberId === turn.hostId) throw new CircleError("The host does not invoice herself");
  if (turn.invoices.some((invoice) => invoice.memberId === memberId)) {
    throw new CircleError(`${memberId} already has an invoice for this gathering`);
  }

  const invoice: Invoice = { memberId, amountCents, status: "draft" };
  return replaceTurn(circle, { ...turn, invoices: [...turn.invoices, invoice] });
}

export function setInvoiceStatus(circle: Circle, memberId: string, status: InvoiceStatus): Circle {
  const turn = requireTurn(circle, "collecting");
  const invoice = turn.invoices.find((i) => i.memberId === memberId);
  if (!invoice) throw new CircleError(`${memberId} has no invoice for this gathering`);
  if (FINAL_INVOICE_STATUSES.includes(invoice.status)) {
    throw new CircleError(`${memberId}'s invoice is already ${invoice.status}`);
  }

  const invoices = turn.invoices.map((i) => (i.memberId === memberId ? { ...i, status } : i));
  const updated: Turn = { ...turn, invoices };
  return replaceTurn(circle, { ...updated, status: isPotComplete(updated) ? "pot_complete" : "collecting" });
}

export function closeInvoice(circle: Circle, memberId: string): Circle {
  return setInvoiceStatus(circle, memberId, "closed");
}

// The organizer's approval. Returns the one payout call to make; repeating it yields the same batch id.
export function approveRelease(circle: Circle): { circle: Circle; payout: Payout } {
  const turn = requireTurn(circle, "pot_complete");
  const host = circle.members.find((m) => m.id === turn.hostId)!;
  const payout: Payout = {
    senderBatchId: `altin-${circle.id}-m${turn.monthIndex}-${host.id}`,
    receiverEmail: host.email,
    amountCents: potTotalCents(turn),
  };
  return { circle: replaceTurn(circle, { ...turn, status: "releasing", payout }), payout };
}

// Called once PayPal reports the payout batch as SUCCESS.
export function markReleased(circle: Circle): Circle {
  const turn = requireTurn(circle, "releasing");
  const released = replaceTurn(circle, { ...turn, status: "released" });

  const next = released.turns.find((t) => t.status === "upcoming");
  if (!next) return { ...released, status: "completed" };
  return replaceTurn(released, { ...next, status: "collecting" });
}

function requireTurn(circle: Circle, status: TurnStatus): Turn {
  const turn = currentTurn(circle);
  if (circle.status !== "active" || !turn) throw new CircleError("The circle has no gathering in progress");
  if (turn.status !== status) {
    throw new CircleError(`Gathering ${turn.monthIndex} is ${turn.status}, expected ${status}`);
  }
  return turn;
}

function replaceTurn(circle: Circle, turn: Turn): Circle {
  return { ...circle, turns: circle.turns.map((t) => (t.monthIndex === turn.monthIndex ? turn : t)) };
}
