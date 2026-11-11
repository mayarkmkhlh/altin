import { Avatar } from "../../../../components/avatar/avatar";
import { ListRow } from "../../../../components/list-row/list-row";
import { formatUsd } from "../../../../lib/helpers/format-money";

export function ContributionsList({ contributions }: { contributions: { member: string; amountCents: number }[] }) {
  return (
    <ul className="rows rows-plain">
      {contributions.map((c) => (
        <ListRow
          key={c.member}
          variant="plain"
          leading={<Avatar name={c.member} />}
          title={c.member}
          trailing={formatUsd(c.amountCents)}
        />
      ))}
    </ul>
  );
}
