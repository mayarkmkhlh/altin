import type { CSSProperties } from "react";

// Muted hues that sit on the dark green theme; a member keeps the same one everywhere because it comes from her name.
const HUES = [150, 30, 12, 195, 265, 330, 85, 50, 220, 300];

function hueFor(name: string): number {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return HUES[hash % HUES.length]!;
}

export function Avatar({
  name,
  label,
  tone = "neutral",
}: {
  name: string;
  label?: string;
  tone?: "neutral" | "gold" | "paypal";
}) {
  const letters = label ?? Array.from(name)[0] ?? "?";
  const style = tone === "neutral" ? ({ "--avatar-hue": hueFor(name) } as CSSProperties) : undefined;
  return (
    <span className={`avatar avatar-${tone}`} style={style} aria-hidden="true">
      {letters}
    </span>
  );
}
