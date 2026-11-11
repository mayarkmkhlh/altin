export function Loader({ label }: { label: string }) {
  return (
    <p className="loader" role="status">
      <span className="loader-dot" />
      {label}
    </p>
  );
}
