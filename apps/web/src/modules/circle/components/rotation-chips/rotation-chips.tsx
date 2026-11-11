const SHOWN = 4;

export function RotationChips({ hosts }: { hosts: string[] }) {
  const rest = hosts.length - SHOWN;
  return (
    <ol className="chips">
      {hosts.slice(0, SHOWN).map((host, index) => (
        <li key={host + index} className={index === 0 ? "chip is-first" : "chip"}>
          <span className="chip-index">{index + 1}</span>
          {host}
        </li>
      ))}
      {rest > 0 && <li className="chip">+{rest}</li>}
    </ol>
  );
}
