import { type ReactNode, useState } from "react";
import { EmptyState } from "../../../../components/empty-state/empty-state";
import { PageHeader } from "../../../../components/page-header/page-header";
import { SegmentedControl } from "../../../../components/segmented-control/segmented-control";
import type { Copy } from "../../../../hooks/use-language/copy";
import { dayKey, formatDay } from "../../../../lib/helpers/format-date";
import type { CircleView } from "../../../../lib/types/circle-view.type";
import type { Language } from "../../../../lib/types/language.type";
import { type ActivityFilter, groupByDay, matchesFilter } from "../../libs/helpers/activity.helper";
import { ActivityRow } from "../activity-row/activity-row";

export function ActivityPage({
  circle,
  copy,
  language,
  menu,
}: {
  circle: CircleView;
  copy: Copy;
  language: Language;
  menu: ReactNode;
}) {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const groups = groupByDay(circle.activity.filter((entry) => matchesFilter(entry, filter)));
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const dayLabel = (iso: string) =>
    dayKey(iso) === today ? copy.activity.today : dayKey(iso) === yesterday ? copy.activity.yesterday : formatDay(iso, language);

  return (
    <>
      <PageHeader kicker={circle.name} title={copy.activity.title} subtitle={copy.activity.subtitle} action={menu} />
      <SegmentedControl
        label={copy.activity.title}
        value={filter}
        onChange={setFilter}
        options={(["all", "money", "assistant", "you"] as const).map((value) => ({
          value,
          label: copy.activity.filters[value],
        }))}
      />
      {groups.length === 0 ? (
        <EmptyState icon="list" title={copy.activity.empty} />
      ) : (
        groups.map((group) => (
          <section key={group.day}>
            <h2 className="section-label">{dayLabel(group.day)}</h2>
            <ul className="rows rows-plain">
              {group.entries.map((entry) => (
                <ActivityRow key={entry.id} entry={entry} copy={copy} language={language} />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
