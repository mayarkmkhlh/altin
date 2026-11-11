import type { ReactNode } from "react";
import { Avatar } from "../../../../components/avatar/avatar";
import { Badge } from "../../../../components/badge/badge";
import { ListRow } from "../../../../components/list-row/list-row";
import { PageHeader } from "../../../../components/page-header/page-header";
import type { Copy } from "../../../../hooks/use-language/copy";
import type { Tab } from "../../../../hooks/use-route/use-route.hook";
import type { CircleView, CurrentGathering, InvoiceStatus } from "../../../../lib/types/circle-view.type";
import type { Language } from "../../../../lib/types/language.type";
import { MemberRow } from "../member-row/member-row";
import { PotCard } from "../pot-card/pot-card";
import { RotationList } from "../rotation-list/rotation-list";
import { StatusBanner } from "../status-banner/status-banner";

// Open invoices first: those are the ones the organizer may need to chase.
const order: Record<InvoiceStatus, number> = { draft: 0, sent: 0, partially_paid: 0, paid: 1, closed: 2 };

export function CirclePage({
  circle,
  copy,
  language,
  menu,
  onOpen,
}: {
  circle: CircleView;
  copy: Copy;
  language: Language;
  menu: ReactNode;
  onOpen: (tab: Tab) => void;
}) {
  const current = circle.current;
  return (
    <>
      <PageHeader
        kicker={circle.name}
        title={current ? copy.board.gathering(current.index, circle.gatherings.length) : circle.name}
        action={menu}
      />
      {circle.status === "completed" && <StatusBanner tone="ok">{copy.board.circleComplete}</StatusBanner>}
      {current && (
        <>
          <PotCard gathering={current} copy={copy} language={language} />
          <NextStep circle={circle} current={current} copy={copy} onOpen={onOpen} />
          <section>
            <h2 className="section-label">{copy.board.thisGathering}</h2>
            <ul className="rows">
              <ListRow
                leading={<Avatar name={current.host} tone="gold" />}
                title={current.host}
                subtitle={copy.board.receivesPot}
                trailingNote={<Badge tone="gold">{copy.board.hostRow}</Badge>}
              />
              {[...current.invoices]
                .sort((a, b) => order[a.status] - order[b.status])
                .map((invoice) => (
                  <MemberRow key={invoice.memberId} invoice={invoice} host={current.host} copy={copy} language={language} />
                ))}
              {current.notInvoiced.map((member) => (
                <ListRow
                  key={member.memberId}
                  leading={<Avatar name={member.member} />}
                  title={member.member}
                  trailingNote={<Badge>{copy.board.noInvoice}</Badge>}
                />
              ))}
            </ul>
          </section>
        </>
      )}
      <section>
        <h2 className="section-label">{copy.board.rotation}</h2>
        <RotationList gatherings={circle.gatherings} copy={copy} language={language} />
      </section>
    </>
  );
}

function NextStep({
  circle,
  current,
  copy,
  onOpen,
}: {
  circle: CircleView;
  current: CurrentGathering;
  copy: Copy;
  onOpen: (tab: Tab) => void;
}) {
  if (current.status === "releasing") return <StatusBanner tone="info">{copy.board.payingOut(current.host)}</StatusBanner>;
  if (current.status === "pot_complete") {
    return circle.pendingPayouts.length > 0 ? (
      <StatusBanner tone="gold" actionLabel={copy.chat.reviewPayout} onAction={() => onOpen("approvals")}>
        {copy.board.reviewPayout(current.host)}
      </StatusBanner>
    ) : (
      <StatusBanner tone="gold" actionLabel={copy.tabs.assistant} onAction={() => onOpen("assistant")}>
        {copy.board.askToPropose}
      </StatusBanner>
    );
  }
  if (current.invoiceCount === 0) {
    return (
      <StatusBanner tone="info" actionLabel={copy.board.sendInvoices} onAction={() => onOpen("assistant")}>
        {copy.board.noInvoicesYet}
      </StatusBanner>
    );
  }
  return null;
}
