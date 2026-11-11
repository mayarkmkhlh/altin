import { Avatar } from "../../../../components/avatar/avatar";
import { Badge, type BadgeTone } from "../../../../components/badge/badge";
import { ListRow } from "../../../../components/list-row/list-row";
import type { Copy } from "../../../../hooks/use-language/copy";
import { formatDay } from "../../../../lib/helpers/format-date";
import { formatUsd } from "../../../../lib/helpers/format-money";
import type { GatheringInvoice, InvoiceStatus } from "../../../../lib/types/circle-view.type";
import type { Language } from "../../../../lib/types/language.type";

const tones: Record<InvoiceStatus, BadgeTone> = {
  draft: "neutral",
  sent: "warn",
  partially_paid: "warn",
  paid: "ok",
  closed: "neutral",
};

export function MemberRow({
  invoice,
  host,
  copy,
  language,
}: {
  invoice: GatheringInvoice;
  host: string;
  copy: Copy;
  language: Language;
}) {
  const amount = formatUsd(invoice.amountCents, { whole: true });
  const subtitle =
    invoice.status === "paid" && invoice.paidAt
      ? copy.board.paidOn(formatDay(invoice.paidAt, language))
      : invoice.amountSource
        ? copy.board.amountSource(invoice.amountSource, host, invoice.member, amount)
        : undefined;

  return (
    <ListRow
      leading={<Avatar name={invoice.member} />}
      title={invoice.member}
      subtitle={subtitle}
      trailing={amount}
      trailingNote={<Badge tone={tones[invoice.status]}>{copy.board.invoiceStatus[invoice.status]}</Badge>}
    />
  );
}
