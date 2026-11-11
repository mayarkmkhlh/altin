import { useState } from "react";
import { Avatar } from "../../../../components/avatar/avatar";
import type { Copy } from "../../../../hooks/use-language/copy";
import { formatAgo } from "../../../../lib/helpers/format-date";
import { formatUsd } from "../../../../lib/helpers/format-money";
import type { PendingPayout } from "../../../../lib/types/circle-view.type";
import type { Language } from "../../../../lib/types/language.type";
import { ContributionsList } from "../contributions-list/contributions-list";

export function PayoutCard({ payout, copy, language }: { payout: PendingPayout; copy: Copy; language: Language }) {
  const [showWho, setShowWho] = useState(false);
  const amounts = payout.contributions.map((c) => c.amountCents);

  return (
    <section className="card payout-card">
      <header className="payout-head">
        <Avatar name={payout.host} tone="gold" />
        <div className="row-text">
          <span className="row-title">{copy.approvals.receives(payout.host)}</span>
          <span className="row-subtitle" dir="ltr">
            PayPal · {payout.receiverEmail}
          </span>
        </div>
        <span className="row-amount">{formatUsd(payout.amountCents)}</span>
      </header>
      <dl className="facts facts-grid">
        <div>
          <dt>{copy.approvals.from}</dt>
          <dd>{copy.approvals.ownAmounts(payout.contributions.length)}</dd>
        </div>
        {amounts.length > 0 && (
          <div>
            <dt>{copy.approvals.range}</dt>
            <dd>
              {formatUsd(Math.max(...amounts), { whole: true })} · {formatUsd(Math.min(...amounts), { whole: true })}
            </dd>
          </div>
        )}
        <div>
          <dt>{copy.approvals.proposedBy}</dt>
          <dd>{copy.approvals.assistantAgo(formatAgo(payout.proposedAt, language))}</dd>
        </div>
        <div>
          <dt>{copy.approvals.sentFrom}</dt>
          <dd>{copy.approvals.yourPayPal}</dd>
        </div>
      </dl>
      {payout.closedCount > 0 && <p className="muted">{copy.approvals.closed(payout.closedCount)}</p>}
      <button type="button" className="link-button" aria-expanded={showWho} onClick={() => setShowWho(!showWho)}>
        {showWho ? copy.approvals.hideWho : copy.approvals.showWho}
      </button>
      {showWho && <ContributionsList contributions={payout.contributions} />}
    </section>
  );
}
