export type IconName = "circle" | "chat" | "shield" | "list" | "more" | "back" | "lock" | "check" | "send" | "chevron";

const paths: Record<IconName, string> = {
  circle: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  chat: "M4 5h16v11H9l-5 4V5Z",
  shield: "M12 3 5 6v6c0 4.2 3 7.6 7 9 4-1.4 7-4.8 7-9V6l-7-3Zm-3.2 9 2.2 2.2 4.4-4.4",
  list: "M5 7h14M5 12h14M5 17h9",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  back: "M14.5 6 8.5 12l6 6",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  check: "M5 12.5 9.2 17 19 7",
  send: "M5 12h13M13 6l6 6-6 6",
  chevron: "M9.5 6 15.5 12l-6 6",
};

// Icons that point somewhere are mirrored in Arabic by the .icon-directional class.
const directional: IconName[] = ["back", "send", "chevron"];

export function Icon({ name, label }: { name: IconName; label?: string }) {
  const className = directional.includes(name) ? "icon icon-directional" : "icon";
  return (
    <svg className={className} viewBox="0 0 24 24" role={label ? "img" : undefined} aria-label={label} aria-hidden={!label}>
      <path d={paths[name]} />
    </svg>
  );
}
