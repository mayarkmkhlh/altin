import { ProgressRing } from "../../../../components/progress-ring/progress-ring";
import type { Copy } from "../../../../hooks/use-language/copy";
import { formatMonth } from "../../../../lib/helpers/format-date";
import { formatSar, formatUsd } from "../../../../lib/helpers/format-money";
import type { CurrentGathering } from "../../../../lib/types/circle-view.type";
import type { Language } from "../../../../lib/types/language.type";

export function PotCard({ gathering, copy, language }: { gathering: CurrentGathering; copy: Copy; language: Language }) {
  const payable = gathering.invoiceCount - gathering.closedCount;
  const share = payable > 0 ? gathering.paidCount / payable : 0;

  return (
    <section className="card pot-card">
      <ProgressRing value={share} label={copy.board.paidOf(gathering.paidCount, payable)}>
        <span className="kicker">{copy.board.inThePot}</span>
        <span className="pot-amount">{formatUsd(gathering.potCents, { whole: true })}</span>
        <span className="pot-sar">{formatSar(gathering.potCents)}</span>
        {gathering.pledgedCents > 0 && (
          <span className="pot-note">{copy.board.ofPledged(formatUsd(gathering.pledgedCents, { whole: true }))}</span>
        )}
      </ProgressRing>
      <dl className="pot-facts">
        <div>
          <dt>{copy.board.hostThisTime}</dt>
          <dd>
            {gathering.host} · {formatMonth(gathering.month, language)}
          </dd>
        </div>
        <div className="pot-facts-end">
          <dt>{copy.board.paid}</dt>
          <dd>{copy.board.paidOf(gathering.paidCount, payable)}</dd>
        </div>
      </dl>
    </section>
  );
}
