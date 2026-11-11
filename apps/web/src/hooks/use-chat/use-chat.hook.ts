import { useCallback, useEffect, useState } from "react";
import { postJson } from "../../lib/http/http";

export type ChatMessage = { role: "user" | "assistant"; content: string; toolCalls?: string[] };
type AgentReply = { reply: string; circleId?: string; toolCalls: string[] };

// The server keeps no chat history: the browser sends the conversation each turn, so it lives in localStorage.
const MAX_SENT = 40;
const keyFor = (circleId: string | null) => `altin:chat:${circleId ?? "new"}`;

function load(circleId: string | null): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(keyFor(circleId)) ?? "[]") as ChatMessage[];
  } catch {
    return [];
  }
}

export function useChat(
  circleId: string | null,
  onCircleCreated: (circleId: string) => void,
): { messages: ChatMessage[]; sending: boolean; failed: boolean; send: (text: string) => Promise<void> } {
  const [messages, setMessages] = useState<ChatMessage[]>(() => load(circleId));
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => setMessages(load(circleId)), [circleId]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || sending) return;
      const next: ChatMessage[] = [...messages, { role: "user", content }];
      setMessages(next);
      setSending(true);
      setFailed(false);
      try {
        const result = await postJson<AgentReply>("/api/agent", {
          ...(circleId && { circleId }),
          messages: next.slice(-MAX_SENT).map(({ role, content }) => ({ role, content })),
        });
        const answered: ChatMessage[] = [...next, { role: "assistant", content: result.reply, toolCalls: result.toolCalls }];
        setMessages(answered);
        if (!circleId && result.circleId) {
          localStorage.setItem(keyFor(result.circleId), JSON.stringify(answered));
          localStorage.removeItem(keyFor(null));
          onCircleCreated(result.circleId);
        } else {
          localStorage.setItem(keyFor(circleId), JSON.stringify(answered));
        }
      } catch {
        setFailed(true);
        localStorage.setItem(keyFor(circleId), JSON.stringify(next));
      } finally {
        setSending(false);
      }
    },
    [circleId, messages, onCircleCreated, sending],
  );

  return { messages, sending, failed, send };
}
