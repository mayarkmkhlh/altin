import type { ReactNode } from "react";

export type BadgeTone = "ok" | "warn" | "gold" | "neutral";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
