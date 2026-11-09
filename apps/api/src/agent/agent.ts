import { generateText, type LanguageModel, type ModelMessage, stepCountIs, tool } from "ai";
import { z } from "zod";
import {
  type AgentDeps,
  circleSummary,
  createCircleAction,
  createCircleInput,
  proposePayoutAction,
  sendMemberInvoicesAction,
  sendMemberInvoicesInput,
} from "./actions";

function systemPrompt(today: string, summary: string | null): string {
  return `${basePrompt(today)}\n\n${summary ?? "No circle has been created in this conversation yet."}`;
}

function basePrompt(today: string): string {
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
      execute: audited(deps, "create_circle", (input: z.infer<typeof createCircleInput>) =>
        createCircleAction(deps, input),
      ),
    }),
    send_member_invoices: tool({
      description:
        "Send this gathering's PayPal invoices to every member except the host. Amounts come from what the organizer stated, then the payback suggestion, then the usual amount.",
      inputSchema: sendMemberInvoicesInput,
      execute: audited(deps, "send_member_invoices", (input: z.infer<typeof sendMemberInvoicesInput>) =>
        sendMemberInvoicesAction(deps, input),
      ),
    }),
    propose_payout: tool({
      description:
        "When every invoice for this gathering is paid or closed, ask the organizer to approve releasing the pot to the host. Does not move money.",
      inputSchema: z.object({}),
      execute: audited(deps, "propose_payout", () => proposePayoutAction(deps)),
    }),
  };
}

// Successful actions write their own audit entries; this records the attempts that failed.
function audited<I, O>(deps: AgentDeps, toolName: string, run: (input: I) => Promise<O>) {
  return async (input: I): Promise<O> => {
    try {
      return await run(input);
    } catch (err) {
      if (deps.session.circleId) {
        await deps.store.audit(deps.session.circleId, "agent", "tool_failed", {
          tool: toolName,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      throw err;
    }
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
    system: systemPrompt(input.today, await circleSummary(input.deps)),
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
