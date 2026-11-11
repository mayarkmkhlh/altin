import { Badge, type BadgeTone } from "../../../../components/badge/badge";
import type { Copy } from "../../../../hooks/use-language/copy";
import { formatMonth } from "../../../../lib/helpers/format-date";
import { formatUsd } from "../../../../lib/helpers/format-money";
import type { Gathering, GatheringStatus } from "../../../../lib/types/circle-view.type";
import type { Language } from "../../../../lib/types/language.type";

const tones: Record<GatheringStatus, BadgeTone> = {
  upcoming: "neutral",
  collecting: "gold",
  pot_complete: "gold",
  releasing: "gold",
  released: "ok",
};

export function RotationList({ gatherings, copy, language }: { gatherings: Gathering[]; copy: Copy; language: Language }) {
  return (
    <ol className="rotation">
      {gatherings.map((g) => (
        <li key={g.index} className={g.status === "upcoming" || g.status === "released" ? "rotation-item" : "rotation-item is-now"}>
          <span className="rotation-index">{g.index}</span>
          <span className="rotation-host">{g.host}</span>
          <span className="rotation-month">{formatMonth(g.month, language)}</span>
          <span className="rotation-status">
            {g.status === "released" && <span className="rotation-pot">{formatUsd(g.potCents, { whole: true })}</span>}
            <Badge tone={tones[g.status]}>{copy.board.gatheringStatus[g.status]}</Badge>
          </span>
        </li>
      ))}
    </ol>
  );
}
