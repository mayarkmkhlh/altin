import type { ReactNode } from "react";
import { Icon } from "../icon/icon";

export function PageHeader({
  kicker,
  title,
  subtitle,
  onBack,
  backLabel,
  action,
}: {
  kicker?: string;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      {onBack && (
        <button type="button" className="icon-button" onClick={onBack} aria-label={backLabel}>
          <Icon name="back" />
        </button>
      )}
      <div className="page-header-text">
        {kicker && <p className="kicker">{kicker}</p>}
        {title && <h1>{title}</h1>}
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
