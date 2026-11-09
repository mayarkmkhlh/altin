import type { Circle } from "./circle";

export type MemberBalance = { memberId: string; paidInCents: number; receivedCents: number; netCents: number };

// Read-only view: money in is every paid invoice, money out is every pot PayPal confirmed as released.
export function memberBalances(circle: Circle): MemberBalance[] {
  return circle.members.map((member) => {
    const paidInCents = circle.turns
      .flatMap((turn) => turn.invoices)
      .filter((invoice) => invoice.memberId === member.id && invoice.status === "paid")
      .reduce((sum, invoice) => sum + invoice.amountCents, 0);

    const receivedCents = circle.turns
      .filter((turn) => turn.hostId === member.id && turn.status === "released")
      .reduce((sum, turn) => sum + (turn.payout?.amountCents ?? 0), 0);

    return { memberId: member.id, paidInCents, receivedCents, netCents: receivedCents - paidInCents };
  });
}

// What the host gave at the giver's own most recent gathering. A suggestion only; the giver can change it.
export function paybackSuggestion(circle: Circle, giverId: string, hostId: string): number | null {
  const gift = circle.turns
    .filter((turn) => turn.hostId === giverId)
    .sort((a, b) => b.monthIndex - a.monthIndex)
    .flatMap((turn) => turn.invoices)
    .find((invoice) => invoice.memberId === hostId && invoice.status === "paid");

  return gift?.amountCents ?? null;
}
