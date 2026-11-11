// Mirrors circleView() in apps/api/src/circle-view.ts. Amounts are integer US cents.
export type CircleStatus = "forming" | "active" | "completed";
export type GatheringStatus = "upcoming" | "collecting" | "pot_complete" | "releasing" | "released";
export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "closed";
export type AmountSource = "organizer" | "payback" | "usual";
export type Actor = "agent" | "organizer" | "paypal" | "system";

export type Gathering = {
  index: number;
  month: string;
  hostId: string;
  host: string;
  status: GatheringStatus;
  potCents: number;
  paidCount: number;
  invoiceCount: number;
};

export type GatheringInvoice = {
  memberId: string;
  member: string;
  amountCents: number;
  status: InvoiceStatus;
  amountSource: AmountSource | null;
  paidAt: string | null;
};

export type CurrentGathering = Gathering & {
  pledgedCents: number;
  closedCount: number;
  invoices: GatheringInvoice[];
  notInvoiced: { memberId: string; member: string }[];
};

export type PendingPayout = {
  id: string;
  index: number;
  host: string;
  receiverEmail: string;
  amountCents: number;
  proposedAt: string;
  contributions: { member: string; amountCents: number }[];
  closedCount: number;
};

export type ActivityEntry = {
  id: number;
  actor: Actor;
  action: string;
  details: Record<string, unknown>;
  at: string;
};

export type CircleView = {
  id: string;
  name: string;
  status: CircleStatus;
  startMonth: string;
  suggestedPledgeCents: number | null;
  members: { id: string; name: string; position: number }[];
  gatherings: Gathering[];
  current: CurrentGathering | null;
  pendingPayouts: PendingPayout[];
  activity: ActivityEntry[];
};
