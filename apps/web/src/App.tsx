import { useEffect, useState } from "react";
import { CirclePage } from "./CirclePage";

type Health = { ok: boolean; db: string; tables?: string[] };

const circleId = window.location.pathname.match(/^\/circles\/([0-9a-f-]{36})\/?$/i)?.[1];

export function App() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, marginInline: "auto", padding: 24 }}>
      {circleId ? <CirclePage circleId={circleId} /> : <Home />}
    </main>
  );
}

function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json() as Promise<Health>)
      .then(setHealth)
      .catch((err: unknown) => setError(String(err)));
  }, []);

  return (
    <>
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
    </>
  );
}
