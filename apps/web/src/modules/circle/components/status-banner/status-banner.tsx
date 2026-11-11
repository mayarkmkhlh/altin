import type { ReactNode } from "react";
import { Icon } from "../../../../components/icon/icon";

// One line that tells the organizer what the circle needs next, with the button that does it.
export function StatusBanner({
  tone,
  children,
  actionLabel,
  onAction,
}: {
  tone: "gold" | "ok" | "info";
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className={`banner banner-${tone}`} role="status">
      <p>{children}</p>
      {actionLabel && onAction && (
        <button type="button" className="banner-action" onClick={onAction}>
          {actionLabel}
          <Icon name="chevron" />
        </button>
      )}
    </div>
  );
}
