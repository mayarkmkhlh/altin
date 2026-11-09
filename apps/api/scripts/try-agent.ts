// Talks to the real Muse Spark model, but with an in-memory database and a fake PayPal,
// so trying the agent never touches Neon or sends an invoice.
// Run from apps/api: npx tsx --env-file=../../.env.local scripts/try-agent.ts "your message"
// A follow-up of "/pay-all" marks the current gathering's invoices paid, standing in for the PayPal webhook.
import type { ModelMessage } from "ai";
import type { AgentDeps } from "../src/agent/actions";
import { runAgent } from "../src/agent/agent";
import { museSparkModel } from "../src/agent/model";
import { CircleStore } from "../src/store/circle-store";
import { testDb } from "../src/test/test-db";

const first = process.argv[2] ?? "عشر بنات، ألف ريال بالشهر، نبدأ ديسمبر، أختي مريم أول وحدة عشان عرسها";

const db = await testDb();
const deps: AgentDeps = {
  store: new CircleStore(db),
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

const messages: ModelMessage[] = [];

for (const message of [first, ...process.argv.slice(3)]) {
  if (message === "/pay-all") {
    await payCurrentGathering();
    continue;
  }
  messages.push({ role: "user", content: message });
  console.log(`\norganizer: ${message}`);
  const result = await runAgent({ model: museSparkModel(), deps, messages, today: new Date().toISOString().slice(0, 10) });
  console.log(`tools: ${result.toolCalls.join(", ") || "none"}`);
  console.log(`altın: ${result.reply}`);
  messages.push({ role: "assistant", content: result.reply });
}

async function payCurrentGathering() {
  const turn = await db.query<{ id: string; month_index: number }>(
    "select id, month_index from turns where circle_id = $1 and status = 'collecting'",
    [deps.session.circleId],
  );
  const current = turn.rows[0];
  if (!current) return console.log("\n  [fake webhook] no gathering is collecting");
  await db.query("update invoices set status = 'paid' where turn_id = $1", [current.id]);
  await db.query("update turns set status = 'pot_complete' where id = $1", [current.id]);
  console.log(`\n  [fake webhook] every invoice for gathering ${current.month_index} is now paid`);
}

if (deps.session.circleId) {
  const { circle } = await deps.store.loadCircle(deps.session.circleId);
  console.log("\nrotation:", circle.turns.map((t) => circle.members.find((m) => m.id === t.hostId)!.name).join(" → "));
}
