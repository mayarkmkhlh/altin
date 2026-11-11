// A local server with an in-memory database, a seeded circle and a fake PayPal, for building and rehearsing the UI.
// Run from apps/api: npx tsx --env-file=../../.env.local scripts/demo-server.ts   (then `npm run dev:web`)
// The assistant uses the real Muse Spark model when MODEL_API_KEY is set; PayPal is always fake here.
import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { museSparkModel } from "../src/agent/model";
import { createApp } from "../src/app";
import { CircleStore } from "../src/store/circle-store";
import { testDb } from "../src/test/test-db";
import { seedDemoCircle } from "./demo-seed";

const PORT = 3000;
const db = await testDb();
const store = new CircleStore(db);
const { circleId, openInvoiceId } = await seedDemoCircle(db, { organizerEmail: "organizer@altin.example" });

const payoutStartedAt = new Map<string, number>();
const app = createApp({
  store,
  paypal: () => ({
    async createInvoice(input) {
      return `INV-DEMO-${input.requestId.slice(-8)}`;
    },
    async sendInvoice() {},
    async createPayout() {
      const batch = `DEMO-BATCH-${payoutStartedAt.size + 10}`;
      payoutStartedAt.set(batch, Date.now());
      return batch;
    },
    async getPayoutStatus(batchId) {
      return Date.now() - (payoutStartedAt.get(batchId) ?? 0) > 8000 ? "SUCCESS" : "PENDING";
    },
    async verifyWebhookSignature() {
      return false;
    },
    async getInvoiceStatus() {
      return "sent";
    },
  }),
  webhookId: undefined,
  model: museSparkModel,
  organizerEmail: "organizer@altin.example",
  listTables: async () => ["demo"],
});

// Stands in for PayPal: Hessa pays, through the same store call the real webhook makes.
app.post("/api/dev/pay-next", async (c) => {
  const result = await store.recordInvoicePaid({
    eventId: `WH-DEMO-${randomUUID()}`,
    eventType: "INVOICING.INVOICE.PAID",
    paypalInvoiceId: openInvoiceId,
  });
  return c.json(result);
});

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`demo api on http://localhost:${PORT}`);
  console.log(`circle page: http://localhost:5173/circles/${circleId}`);
});
