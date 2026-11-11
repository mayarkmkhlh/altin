import { Icon } from "../../../../components/icon/icon";

// The tools the assistant actually called this turn, so the organizer sees actions, not just words.
export function ToolChips({ tools }: { tools: string[] }) {
  const unique = [...new Set(tools)];
  if (unique.length === 0) return null;
  return (
    <ul className="tool-chips" dir="ltr">
      {unique.map((tool) => (
        <li key={tool}>
          {tool}
          <Icon name="check" />
        </li>
      ))}
    </ul>
  );
}
