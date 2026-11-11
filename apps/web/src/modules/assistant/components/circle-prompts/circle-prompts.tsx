import type { Copy } from "../../../../hooks/use-language/copy";

// An existing circle with an empty chat: say what the assistant can do here, and offer the two common asks.
export function CirclePrompts({ circleName, copy, onPrompt }: { circleName: string; copy: Copy; onPrompt: (text: string) => void }) {
  return (
    <section className="onboarding">
      <p className="muted">{copy.chat.circleHint(circleName)}</p>
      <div className="examples">
        {copy.chat.circlePrompts.map((prompt) => (
          <button key={prompt} type="button" className="example" dir="auto" onClick={() => onPrompt(prompt)}>
            {prompt}
          </button>
        ))}
      </div>
    </section>
  );
}
