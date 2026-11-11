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
  return (
    <span className={`avatar avatar-${tone}`} aria-hidden="true">
      {letters}
    </span>
  );
}
