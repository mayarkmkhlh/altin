import { dayKey } from "../../../../lib/helpers/format-date";
import type { ActivityEntry } from "../../../../lib/types/circle-view.type";

export type ActivityFilter = "all" | "money" | "assistant" | "you";

// Money that actually moved: in when PayPal says an invoice is paid, out when PayPal confirms a payout.
const MONEY_IN = ["invoice_paid"];
const MONEY_OUT = ["payout_succeeded"];
const MONEY_ACTIONS = [...MONEY_IN, ...MONEY_OUT, "invoice_sent", "payout_proposed", "payout_approved", "payout_requested", "payout_created", "payout_failed"];

export function matchesFilter(entry: ActivityEntry, filter: ActivityFilter): boolean {
  if (filter === "money") return MONEY_ACTIONS.includes(entry.action);
  if (filter === "assistant") return entry.actor === "agent";
  if (filter === "you") return entry.actor === "organizer";
  return true;
}

export function moneyDirection(entry: ActivityEntry): "in" | "out" | "neutral" {
  if (MONEY_IN.includes(entry.action)) return "in";
  if (MONEY_OUT.includes(entry.action)) return "out";
  return "neutral";
}

export function amountOf(entry: ActivityEntry): number | null {
  return typeof entry.details.amountCents === "number" ? entry.details.amountCents : null;
}

export function groupByDay(entries: ActivityEntry[]): { day: string; entries: ActivityEntry[] }[] {
  const groups: { day: string; entries: ActivityEntry[] }[] = [];
  for (const entry of entries) {
    const key = dayKey(entry.at);
    const last = groups.at(-1);
    if (last && dayKey(last.entries[0]!.at) === key) last.entries.push(entry);
    else groups.push({ day: entry.at, entries: [entry] });
  }
  return groups;
}
