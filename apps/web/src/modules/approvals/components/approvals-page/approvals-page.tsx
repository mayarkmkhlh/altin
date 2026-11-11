import { type ReactNode, useState } from "react";
import { Badge } from "../../../../components/badge/badge";
import { Button } from "../../../../components/button/button";
import { EmptyState } from "../../../../components/empty-state/empty-state";
import { Icon } from "../../../../components/icon/icon";
import { Loader } from "../../../../components/loader/loader";
import { PageHeader } from "../../../../components/page-header/page-header";
import type { Copy } from "../../../../hooks/use-language/copy";
import { errorDetail, postJson } from "../../../../lib/http/http";
import { formatSar, formatUsd } from "../../../../lib/helpers/format-money";
import type { CircleView } from "../../../../lib/types/circle-view.type";
import type { Language } from "../../../../lib/types/language.type";
import { StatusBanner } from "../../../circle/circle";
import { PayoutCard } from "../payout-card/payout-card";

type ApproveResult = { ok: true } | { ok: false; reason: string };

export function ApprovalsPage({
  circle,
  copy,
  language,
  menu,
  onBack,
  onChanged,
}: {
  circle: CircleView;
  copy: Copy;
  language: Language;
  menu: ReactNode;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvedHost, setApprovedHost] = useState<string | null>(null);
  const payout = circle.pendingPayouts[0];
  const paying = circle.gatherings.find((g) => g.status === "releasing");

  async function approve() {
    if (!payout) return;
    setApproving(true);
    setError(null);
    try {
      await postJson<ApproveResult>(`/api/circles/${circle.id}/payouts/${payout.id}/approve`);
      setApprovedHost(payout.host);
    } catch (failure) {
      setError(errorDetail(failure) ?? copy.common.loadError);
    } finally {
      setApproving(false);
      await onChanged();
    }
  }

  if (!payout) {
    return (
      <>
        <PageHeader title={copy.tabs.approvals} kicker={circle.name} action={menu} />
        {error && <p className="error-note">{error}</p>}
        {approvedHost && !paying && <StatusBanner tone="ok">{copy.approvals.confirmed(approvedHost)}</StatusBanner>}
        {paying ? (
          <section className="card paying">
            <Loader label={copy.approvals.payingTitle(paying.host)} />
            <p className="pot-amount">{formatUsd(paying.potCents)}</p>
            <p className="muted">{copy.approvals.payingBody}</p>
          </section>
        ) : (
          <EmptyState icon="shield" title={copy.approvals.emptyTitle}>
            {copy.approvals.emptyBody}
          </EmptyState>
        )}
      </>
    );
  }

  return (
    <div className="approval">
      <PageHeader kicker={copy.approvals.kicker(payout.index, circle.name)} onBack={onBack} backLabel={copy.common.back} />
      <div className="approval-hero">
        <Badge tone="ok">
          <Icon name="check" />
          {copy.approvals.potComplete(payout.contributions.length)}
        </Badge>
        <p className="hero-amount">{formatUsd(payout.amountCents, { whole: true })}</p>
        <p className="muted">
          {formatSar(payout.amountCents)} · {copy.approvals.readyFor(payout.host)}
        </p>
      </div>
      <PayoutCard payout={payout} copy={copy} language={language} />
      <p className="trust">
        <Icon name="shield" />
        {copy.approvals.trust}
      </p>
      {error && <p className="error-note">{error}</p>}
      <div className="approval-actions">
        <Button block onClick={() => void approve()} disabled={approving}>
          <Icon name="lock" />
          {approving ? copy.approvals.approving : copy.approvals.approve(payout.host)}
        </Button>
        <Button block variant="ghost" onClick={onBack} disabled={approving}>
          {copy.approvals.notNow}
        </Button>
      </div>
    </div>
  );
}
