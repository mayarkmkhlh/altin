// The model sometimes writes **bold**; show it as bold rather than as asterisks. Nothing else is parsed.
function withBold(text: string) {
  return text.split(/\*\*(.+?)\*\*/g).map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part));
}

// dir="auto" lets each message pick its own direction, so English inside the Arabic UI still reads correctly.
export function MessageBubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  return (
    <div className={`bubble bubble-${role}`} dir="auto">
      {role === "assistant" ? withBold(text) : text}
    </div>
  );
}
