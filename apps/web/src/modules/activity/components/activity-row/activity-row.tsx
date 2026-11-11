import { Avatar } from "../../../../components/avatar/avatar";
import { ListRow } from "../../../../components/list-row/list-row";
import type { Copy } from "../../../../hooks/use-language/copy";
import { formatTime } from "../../../../lib/helpers/format-date";
import { formatUsd } from "../../../../lib/helpers/format-money";
import type { Actor, ActivityEntry } from "../../../../lib/types/circle-view.type";
import type { Language } from "../../../../lib/types/language.type";
import { amountOf, moneyDirection } from "../../libs/helpers/activity.helper";

const avatars: Record<Actor, { label: string; tone: "neutral" | "gold" | "paypal" }> = {
  organizer: { label: "", tone: "gold" },
  agent: { label: "AI", tone: "neutral" },
  paypal: { label: "PP", tone: "paypal" },
  system: { label: "A", tone: "neutral" },
};

const money = (cents: unknown) => (typeof cents === "number" ? formatUsd(cents) : "");

export function ActivityRow({ entry, copy, language }: { entry: ActivityEntry; copy: Copy; language: Language }) {
  const actor = copy.activity.actors[entry.actor];
  const avatar = avatars[entry.actor];
  const amount = amountOf(entry);
  const direction = moneyDirection(entry);
  const sign = direction === "in" ? "+" : direction === "out" ? "−" : "";

  return (
    <ListRow
      variant="plain"
      leading={<Avatar name={actor} label={avatar.label || actor} tone={avatar.tone} />}
      title={copy.activity.describe(entry.action, entry.details, money)}
      subtitle={`${actor} · ${formatTime(entry.at, language)}`}
      trailing={
        amount !== null ? (
          <span className={`amount amount-${direction}`} dir="ltr">
            {sign}
            {formatUsd(amount, { whole: true })}
          </span>
        ) : undefined
      }
    />
  );
}
