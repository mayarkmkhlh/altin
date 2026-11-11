import { Button } from "../../../../components/button/button";
import type { Copy } from "../../../../hooks/use-language/copy";
import { formatMonth } from "../../../../lib/helpers/format-date";
import { formatSar, formatUsd } from "../../../../lib/helpers/format-money";
import type { CircleView } from "../../../../lib/types/circle-view.type";
import type { Language } from "../../../../lib/types/language.type";
import { RotationChips } from "../../../circle/circle";

export function CircleCard({
  circle,
  copy,
  language,
  sending,
  onSendInvoices,
  onOpenCircle,
}: {
  circle: CircleView;
  copy: Copy;
  language: Language;
  sending: boolean;
  onSendInvoices: () => void;
  onOpenCircle: () => void;
}) {
  const pledge = circle.suggestedPledgeCents;
  // Invoices can only go out while the gathering in progress still has members without one.
  const canInvoice = circle.current?.status === "collecting" && circle.current.notInvoiced.length > 0;

  return (
    <section className="card circle-card">
      <header className="circle-card-head">
        <h2>{circle.name}</h2>
        <span className="muted">{copy.chat.members(circle.members.length)}</span>
      </header>
      <dl className="facts">
        <div>
          <dt>{copy.chat.schedule}</dt>
          <dd>{copy.chat.monthlyFrom(formatMonth(circle.startMonth, language))}</dd>
        </div>
        <div>
          <dt>{copy.chat.amount}</dt>
          <dd>{pledge ? copy.chat.usualAmount(`${formatUsd(pledge)} (${formatSar(pledge)})`) : copy.chat.eachChooses}</dd>
        </div>
      </dl>
      <p className="facts-label">{copy.chat.rotation}</p>
      <RotationChips hosts={circle.gatherings.map((g) => g.host)} />
      <div className="actions">
        {canInvoice && (
          <Button onClick={onSendInvoices} disabled={sending}>
            {copy.chat.sendInvoices}
          </Button>
        )}
        <Button variant={canInvoice ? "ghost" : "primary"} onClick={onOpenCircle}>
          {copy.chat.openCircle}
        </Button>
      </div>
    </section>
  );
}
