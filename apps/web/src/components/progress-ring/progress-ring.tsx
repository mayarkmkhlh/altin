import type { ReactNode } from "react";

const RADIUS = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// The ring fills with the share of invoices paid; the centre holds whatever the caller puts there.
export function ProgressRing({ value, label, children }: { value: number; label: string; children: ReactNode }) {
  const share = Math.min(1, Math.max(0, value));
  return (
    <div className="ring" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle className="ring-track" cx="100" cy="100" r={RADIUS} />
        <circle
          className="ring-fill"
          cx="100"
          cy="100"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - share)}
        />
      </svg>
      <div className="ring-centre">{children}</div>
    </div>
  );
}
