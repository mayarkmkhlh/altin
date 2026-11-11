import { Icon } from "../../../../components/icon/icon";
import type { Copy } from "../../../../hooks/use-language/copy";

// First run: what Altın does, what it never does, and an example the organizer can tap to start from.
export function Onboarding({ copy, onExample }: { copy: Copy; onExample: (text: string) => void }) {
  return (
    <section className="onboarding">
      <p className="brand">{copy.appName}</p>
      <h1>{copy.chat.onboardingTitle}</h1>
      <p className="muted">{copy.chat.onboardingBody}</p>
      <ul className="rules">
        {copy.chat.onboardingRules.map((rule, index) => (
          <li key={rule}>
            <Icon name={index === 2 ? "shield" : "check"} />
            {rule}
          </li>
        ))}
      </ul>
      <div className="examples">
        {copy.chat.examples.map((example) => (
          <button key={example} type="button" className="example" dir="auto" onClick={() => onExample(example)}>
            {example}
          </button>
        ))}
      </div>
    </section>
  );
}
