import assert from "node:assert/strict";
import { test } from "node:test";
import { MockLanguageModelV4 } from "ai/test";
import { CircleStore } from "../store/circle-store";
import { testDb } from "../test/test-db";
import type { AgentDeps } from "./actions";
import { runAgent } from "./agent";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

function toolCall(toolName: string, input: unknown) {
  return {
    content: [{ type: "tool-call" as const, toolCallId: "call-1", toolName, input: JSON.stringify(input) }],
    finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
    usage,
    warnings: [],
  };
}

function reply(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage,
    warnings: [],
  };
}

async function deps(): Promise<AgentDeps> {
  return {
    store: new CircleStore(await testDb()),
    paypal: {
      createInvoice: async () => "INV-1",
      sendInvoice: async () => {},
    },
    organizerEmail: "organizer@example.com",
    session: {},
  };
}

test("an Arabic setup message becomes a validated create_circle call and a saved circle", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: [
      toolCall("create_circle", {
        name: "جمعية الذهب",
        members: [{ name: "مريم" }, { name: "ليلى" }, { name: "نور" }],
        startMonth: "2026-12",
        suggestedPledge: { amount: 1000, currency: "SAR" },
      }),
      reply("تمام، سوّيت الجمعية. مريم أول وحدة."),
    ],
  });
  const agentDeps = await deps();

  const result = await runAgent({
    model,
    deps: agentDeps,
    messages: [{ role: "user", content: "عشر بنات، ألف بالشهر، أختي مريم أول وحدة عشان عرسها" }],
    today: "2026-11-09",
  });

  assert.equal(result.reply, "تمام، سوّيت الجمعية. مريم أول وحدة.");
  assert.deepEqual(result.toolCalls, ["create_circle"]);
  assert.ok(result.circleId);
  const saved = await agentDeps.store.loadCircle(result.circleId!);
  assert.deepEqual(saved.circle.members.map((m) => m.name), ["مريم", "ليلى", "نور"]);
});

test("invalid tool input from the model is rejected by the schema and nothing is saved", async () => {
  const model = new MockLanguageModelV4({
    doGenerate: [
      toolCall("create_circle", { name: "Solo", members: [{ name: "Mariam" }], startMonth: "2026-12" }),
      reply("A circle needs at least two members. Who else is joining?"),
    ],
  });
  const agentDeps = await deps();

  const result = await runAgent({
    model,
    deps: agentDeps,
    messages: [{ role: "user", content: "Just me for now" }],
    today: "2026-11-09",
  });

  assert.equal(result.circleId, undefined);
  assert.match(result.reply, /two members/);
});

test("the model is only offered the three council-approved tools", async () => {
  const model = new MockLanguageModelV4({ doGenerate: [reply("Hello")] });
  await runAgent({ model, deps: await deps(), messages: [{ role: "user", content: "hi" }], today: "2026-11-09" });

  const offered = (model.doGenerateCalls[0]!.tools ?? []).map((t) => t.name).sort();
  assert.deepEqual(offered, ["create_circle", "propose_payout", "send_member_invoices"]);
});
