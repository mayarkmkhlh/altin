import type { ReactNode } from "react";

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  trailingNote,
  variant = "card",
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  trailingNote?: ReactNode;
  variant?: "card" | "plain";
}) {
  return (
    <li className={`row row-${variant}`}>
      {leading}
      <div className="row-text">
        <span className="row-title">{title}</span>
        {subtitle && <span className="row-subtitle">{subtitle}</span>}
      </div>
      {(trailing || trailingNote) && (
        <div className="row-trailing">
          {trailing && <span className="row-amount">{trailing}</span>}
          {trailingNote}
        </div>
      )}
    </li>
  );
}
