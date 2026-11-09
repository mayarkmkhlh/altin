import { useEffect, useState } from "react";

type Health = { ok: boolean; db: string; tables?: string[] };

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json() as Promise<Health>)
      .then(setHealth)
      .catch((err: unknown) => setError(String(err)));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, marginInline: "auto", padding: 24 }}>
      <h1>Altın</h1>
      <p>Your AI treasurer for savings circles. Sandbox demo only, no real money moves.</p>
      {error && <p>API unreachable: {error}</p>}
      {!health && !error && <p>Checking the API…</p>}
      {health && (
        <p>
          API: {health.ok ? "up" : "down"} · Database: {health.db}
          {health.tables && <> · Tables: {health.tables.join(", ")}</>}
        </p>
      )}
    </main>
  );
}
