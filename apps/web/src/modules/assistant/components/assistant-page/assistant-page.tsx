import { type ReactNode, useEffect, useRef, useState } from "react";
import { Loader } from "../../../../components/loader/loader";
import { PageHeader } from "../../../../components/page-header/page-header";
import type { ChatMessage } from "../../../../hooks/use-chat/use-chat.hook";
import type { Copy } from "../../../../hooks/use-language/copy";
import type { Tab } from "../../../../hooks/use-route/use-route.hook";
import type { CircleView } from "../../../../lib/types/circle-view.type";
import type { Language } from "../../../../lib/types/language.type";
import { StatusBanner } from "../../../circle/circle";
import { CircleCard } from "../circle-card/circle-card";
import { CirclePrompts } from "../circle-prompts/circle-prompts";
import { Composer } from "../composer/composer";
import { MessageBubble } from "../message-bubble/message-bubble";
import { Onboarding } from "../onboarding/onboarding";
import { ToolChips } from "../tool-chips/tool-chips";

const lastIndexWith = (messages: ChatMessage[], tool: string) =>
  messages.findLastIndex((message) => message.toolCalls?.includes(tool));

export function AssistantPage({
  circle,
  messages,
  sending,
  failed,
  copy,
  language,
  menu,
  onSend,
  onOpen,
}: {
  circle: CircleView | null;
  messages: ChatMessage[];
  sending: boolean;
  failed: boolean;
  copy: Copy;
  language: Language;
  menu: ReactNode;
  onSend: (text: string) => void;
  onOpen: (tab: Tab) => void;
}) {
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sending]);

  // Each card appears once, under the reply that caused it, and always shows the circle as it is now.
  const circleCardAt = lastIndexWith(messages, "create_circle");
  const payoutCardAt = lastIndexWith(messages, "propose_payout");

  return (
    <div className="assistant">
      <PageHeader title={copy.chat.title} subtitle={copy.chat.subtitle} action={menu} />
      {messages.length === 0 &&
        (circle ? (
          <CirclePrompts circleName={circle.name} copy={copy} onPrompt={setDraft} />
        ) : (
          <Onboarding copy={copy} onExample={setDraft} />
        ))}
      <div className="thread">
        {messages.map((message, index) => (
          <div key={index} className={`turn turn-${message.role}`}>
            <MessageBubble role={message.role} text={message.content} />
            {message.toolCalls && <ToolChips tools={message.toolCalls} />}
            {index === circleCardAt && circle && (
              <CircleCard
                circle={circle}
                copy={copy}
                language={language}
                sending={sending}
                onSendInvoices={() => onSend(copy.chat.sendInvoicesMessage)}
                onOpenCircle={() => onOpen("circle")}
              />
            )}
            {index === payoutCardAt && circle && circle.pendingPayouts.length > 0 && (
              <StatusBanner tone="gold" actionLabel={copy.chat.reviewPayout} onAction={() => onOpen("approvals")}>
                {copy.board.reviewPayout(circle.pendingPayouts[0]!.host)}
              </StatusBanner>
            )}
          </div>
        ))}
        {sending && <Loader label={copy.chat.thinking} />}
        {failed && <p className="error-note">{copy.chat.failed}</p>}
        <div ref={end} />
      </div>
      <Composer
        placeholder={copy.chat.placeholder}
        sendLabel={copy.chat.send}
        disabled={sending}
        draft={draft}
        onDraftChange={setDraft}
        onSend={onSend}
      />
    </div>
  );
}
