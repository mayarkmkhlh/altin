import {
  addMember,
  type Circle,
  type CircleStatus,
  createCircle,
  type InvoiceStatus,
  type Payout,
  startCircle,
  type TurnStatus,
} from "../engine/circle";
import type { Db } from "./db";

export type CircleRecord = {
  circle: Circle;
  name: string;
  organizerEmail: string;
  startMonth: string;
  suggestedPledgeCents: number | null;
};

export type NewCircle = {
  name: string;
  organizerEmail: string;
  startMonth: string;
  suggestedPledgeCents: number | null;
  members: { name: string; email: string }[];
};

export type AuditActor = "organizer" | "agent" | "paypal" | "system";

export class CircleStore {
  constructor(private readonly db: Db) {}

  async createCircle(input: NewCircle): Promise<CircleRecord> {
    // The engine validates the circle before anything is written.
    let draft = createCircle("draft");
    input.members.forEach((member, index) => {
      draft = addMember(draft, { id: String(index), ...member });
    });
    startCircle(draft);

    const circleId = await this.db.transaction(async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into circles (name, organizer_email, start_month, suggested_pledge_cents, status)
         values ($1, $2, to_date($3, 'YYYY-MM'), $4, 'active')
         returning id`,
        [input.name, input.organizerEmail, input.startMonth, input.suggestedPledgeCents],
      );
      const id = rows[0]!.id;

      for (const [index, member] of input.members.entries()) {
        const { rows: memberRows } = await tx.query<{ id: string }>(
          `insert into members (circle_id, display_name, email, turn_position)
           values ($1, $2, $3, $4)
           returning id`,
          [id, member.name, member.email, index + 1],
        );
        await tx.query(
          `insert into turns (circle_id, month_index, due_date, recipient_member_id, status)
           values ($1, $2::int, (to_date($3, 'YYYY-MM') + make_interval(months => $2::int - 1))::date, $4, $5)`,
          [id, index + 1, input.startMonth, memberRows[0]!.id, index === 0 ? "collecting" : "upcoming"],
        );
      }
      return id;
    });

    await this.audit(circleId, "agent", "circle_created", { members: input.members.length });
    return this.loadCircle(circleId);
  }

  async loadCircle(circleId: string): Promise<CircleRecord> {
    const { rows: circles } = await this.db.query<{
      id: string;
      name: string;
      organizer_email: string;
      start_month: string;
      suggested_pledge_cents: number | null;
      status: CircleStatus;
    }>(
      `select id, name, organizer_email, to_char(start_month, 'YYYY-MM') as start_month, suggested_pledge_cents, status
       from circles where id = $1`,
      [circleId],
    );
    const row = circles[0];
    if (!row) throw new Error(`Circle ${circleId} not found`);

    const { rows: members } = await this.db.query<{ id: string; display_name: string; email: string }>(
      "select id, display_name, email from members where circle_id = $1 order by turn_position",
      [circleId],
    );
    const { rows: turns } = await this.db.query<{
      id: string;
      month_index: number;
      recipient_member_id: string;
      status: TurnStatus;
      sender_batch_id: string | null;
      payout_amount_cents: number | null;
    }>(
      `select id, month_index, recipient_member_id, status, sender_batch_id, payout_amount_cents
       from turns where circle_id = $1 order by month_index`,
      [circleId],
    );
    const { rows: invoices } = await this.db.query<{
      turn_id: string;
      member_id: string;
      amount_cents: number;
      status: InvoiceStatus;
    }>(
      "select turn_id, member_id, amount_cents, status from invoices where circle_id = $1 order by created_at, id",
      [circleId],
    );

    const circle: Circle = {
      id: row.id,
      status: row.status,
      members: members.map((m) => ({ id: m.id, name: m.display_name, email: m.email })),
      turns: turns.map((turn) => {
        const host = members.find((m) => m.id === turn.recipient_member_id)!;
        const payout: Payout | undefined =
          turn.sender_batch_id && turn.payout_amount_cents
            ? { senderBatchId: turn.sender_batch_id, receiverEmail: host.email, amountCents: turn.payout_amount_cents }
            : undefined;
        return {
          monthIndex: turn.month_index,
          hostId: turn.recipient_member_id,
          status: turn.status,
          invoices: invoices
            .filter((invoice) => invoice.turn_id === turn.id)
            .map((invoice) => ({ memberId: invoice.member_id, amountCents: invoice.amount_cents, status: invoice.status })),
          ...(payout && { payout }),
        };
      }),
    };

    return {
      circle,
      name: row.name,
      organizerEmail: row.organizer_email,
      startMonth: row.start_month,
      suggestedPledgeCents: row.suggested_pledge_cents,
    };
  }

  async saveInvoice(
    circleId: string,
    monthIndex: number,
    invoice: { memberId: string; amountCents: number; paypalInvoiceId: string; status: InvoiceStatus },
  ): Promise<void> {
    await this.db.query(
      `insert into invoices (circle_id, turn_id, member_id, amount_cents, paypal_invoice_id, status)
       select $1, t.id, $3, $4, $5, $6 from turns t where t.circle_id = $1 and t.month_index = $2
       on conflict (turn_id, member_id) do nothing`,
      [circleId, monthIndex, invoice.memberId, invoice.amountCents, invoice.paypalInvoiceId, invoice.status],
    );
  }

  async createPendingPayout(
    circleId: string,
    monthIndex: number,
    payout: Payout,
  ): Promise<{ id: string; created: boolean }> {
    const { rows } = await this.db.query<{ id: string }>(
      `insert into pending_actions (circle_id, turn_id, kind, payload, idempotency_key)
       select $1, t.id, 'payout', $3, $4 from turns t where t.circle_id = $1 and t.month_index = $2
       on conflict (idempotency_key) do nothing
       returning id`,
      [circleId, monthIndex, JSON.stringify(payout), payout.senderBatchId],
    );
    if (rows[0]) return { id: rows[0].id, created: true };

    const { rows: existing } = await this.db.query<{ id: string }>(
      "select id from pending_actions where idempotency_key = $1",
      [payout.senderBatchId],
    );
    return { id: existing[0]!.id, created: false };
  }

  async audit(circleId: string, actor: AuditActor, action: string, details: Record<string, unknown>): Promise<void> {
    await this.db.query("insert into audit (circle_id, actor, action, details) values ($1, $2, $3, $4)", [
      circleId,
      actor,
      action,
      JSON.stringify(details),
    ]);
  }
}
