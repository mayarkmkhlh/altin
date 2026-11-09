// Talks to the real Muse Spark model, but with an in-memory database and a fake PayPal,
// so trying the agent never touches Neon or sends an invoice.
// Run from apps/api: npx tsx --env-file=../../.env.local scripts/try-agent.ts "your message"
import type { ModelMessage } from "ai";
import type { AgentDeps } from "../src/agent/actions";
import { runAgent } from "../src/agent/agent";
import { museSparkModel } from "../src/agent/model";
import { CircleStore } from "../src/store/circle-store";
import { testDb } from "../src/test/test-db";

const first = process.argv[2] ?? "عشر بنات، ألف ريال بالشهر، نبدأ ديسمبر، أختي مريم أول وحدة عشان عرسها";

const deps: AgentDeps = {
  store: new CircleStore(await testDb()),
  paypal: {
    createInvoice: async (input) => {
      console.log(`  [fake PayPal] invoice to ${input.recipientEmail} for ${input.amountCents} cents`);
      return `INV-FAKE-${input.requestId.slice(-6)}`;
    },
    sendInvoice: async () => {},
  },
  organizerEmail: "organizer@altin.example",
  session: {},
};

const messages: ModelMessage[] = [{ role: "user", content: first }];
const followUps = process.argv.slice(3);

for (let turn = 0; turn <= followUps.length; turn++) {
  console.log(`\norganizer: ${(messages.at(-1) as { content: string }).content}`);
  const result = await runAgent({ model: museSparkModel(), deps, messages, today: new Date().toISOString().slice(0, 10) });
  console.log(`tools: ${result.toolCalls.join(", ") || "none"}`);
  console.log(`altın: ${result.reply}`);
  messages.push({ role: "assistant", content: result.reply });
  if (followUps[turn]) messages.push({ role: "user", content: followUps[turn]! });
}

if (deps.session.circleId) {
  const { circle } = await deps.store.loadCircle(deps.session.circleId);
  console.log("\nrotation:", circle.turns.map((t) => circle.members.find((m) => m.id === t.hostId)!.name).join(" → "));
}
