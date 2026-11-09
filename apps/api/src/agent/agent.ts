import { generateText, type LanguageModel, type ModelMessage, stepCountIs, tool } from "ai";
import { z } from "zod";
import {
  type AgentDeps,
  createCircleAction,
  createCircleInput,
  proposePayoutAction,
  sendMemberInvoicesAction,
  sendMemberInvoicesInput,
} from "./actions";

function systemPrompt(today: string): string {
  return `You are Altın, the treasurer assistant for the organizer of a rotating savings circle
(altın günü, jam'iya, tanda, susu). Today is ${today}.

- Reply in the organizer's language: Arabic (Gulf dialect is fine), English or Turkish.
- Members give what they choose at each gathering. There is no fixed contribution; a usual amount is only a default.
- Never do currency arithmetic. Pass amounts exactly as she said them, with currency USD or SAR. The tools convert,
  and you report the USD amounts and SAR labels they return.
- Put members in the rotation order she asks for. The first member hosts the first gathering.
- If you don't know the members' names or the first month, ask before calling create_circle. Never invent names.
- You never move money. propose_payout only prepares a request that the organizer approves with a button; say so.
- Only state facts that a tool returned. If a tool fails, explain it simply and ask what to do.`;
}

export function createTools(deps: AgentDeps) {
  return {
    create_circle: tool({
      description: "Create the savings circle and its rotation from the organizer's description.",
      inputSchema: createCircleInput,
      execute: (input) => createCircleAction(deps, input),
    }),
    send_member_invoices: tool({
      description:
        "Send this gathering's PayPal invoices to every member except the host. Amounts come from what the organizer stated, then the payback suggestion, then the usual amount.",
      inputSchema: sendMemberInvoicesInput,
      execute: (input) => sendMemberInvoicesAction(deps, input),
    }),
    propose_payout: tool({
      description:
        "When every invoice for this gathering is paid or closed, ask the organizer to approve releasing the pot to the host. Does not move money.",
      inputSchema: z.object({}),
      execute: () => proposePayoutAction(deps),
    }),
  };
}

export async function runAgent(input: {
  model: LanguageModel;
  deps: AgentDeps;
  messages: ModelMessage[];
  today: string;
}): Promise<{ reply: string; circleId?: string; toolCalls: string[] }> {
  const result = await generateText({
    model: input.model,
    system: systemPrompt(input.today),
    messages: input.messages,
    tools: createTools(input.deps),
    stopWhen: stepCountIs(6),
  });

  return {
    reply: result.text,
    circleId: input.deps.session.circleId,
    toolCalls: result.steps.flatMap((step) => step.toolCalls.map((call) => call.toolName)),
  };
}
