import type { ReactNode } from "react";

export function Button({
  children,
  variant = "primary",
  type = "button",
  disabled = false,
  block = false,
  onClick,
}: {
  children: ReactNode;
  variant?: "primary" | "ghost" | "quiet";
  type?: "button" | "submit";
  disabled?: boolean;
  block?: boolean;
  onClick?: () => void;
}) {
  const classes = ["btn", `btn-${variant}`, block && "btn-block"].filter(Boolean).join(" ");
  return (
    <button type={type} className={classes} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}
