// Sets up a real sandbox checkout against a deployed Altın: a small circle, invoices sent, then watches the board.
// Pay the buyer's invoice in the PayPal sandbox; the webhook should mark her paid within about 15 seconds.
// Usage: npx tsx scripts/try-webhook.ts https://altin-ub0c.onrender.com buyer@personal.example.com
const [baseUrl, buyerEmail] = process.argv.slice(2);
if (!baseUrl?.startsWith("https://") || !buyerEmail) {
  throw new Error("Usage: npx tsx scripts/try-webhook.ts <https base url> <sandbox buyer email>");
}

type AgentReply = { reply: string; circleId?: string };
type Board = { current: { status: string; invoices: { member: string; status: string; amountCents: number }[] } | null };

async function ask(messages: { role: "user" | "assistant"; content: string }[], circleId?: string): Promise<AgentReply> {
  const res = await fetch(`${baseUrl}/api/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ circleId, messages }),
  });
  if (!res.ok) throw new Error(`agent ${res.status}: ${await res.text()}`);
  return (await res.json()) as AgentReply;
}

async function main() {
  const setup = `Webhook test circle, starting this month. Host first: Mayar (mayar.host@example.com), then Amal (${buyerEmail}). Usual amount 5 dollars.`;
  const created = await ask([{ role: "user", content: setup }]);
  console.log("assistant:", created.reply);
  if (!created.circleId) throw new Error("no circle was created");

  const send = "Send this gathering's invoices, Amal pays the usual 5 dollars.";
  const sent = await ask(
    [
      { role: "user", content: setup },
      { role: "assistant", content: created.reply },
      { role: "user", content: send },
    ],
    created.circleId,
  );
  console.log("assistant:", sent.reply);
  console.log(`\ncircle page: ${baseUrl}/circles/${created.circleId}`);
  console.log("pay Amal's invoice in the sandbox now; watching...\n");

  let last = "";
  for (let i = 0; i < 120; i++) {
    const board = (await (await fetch(`${baseUrl}/api/circles/${created.circleId}`)).json()) as Board;
    const line = (board.current?.invoices ?? []).map((inv) => `${inv.member}: ${inv.status}`).join(", ") + ` | ${board.current?.status}`;
    if (line !== last) console.log(new Date().toLocaleTimeString(), line);
    last = line;
    if (board.current?.invoices.every((inv) => inv.status === "paid")) return;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
