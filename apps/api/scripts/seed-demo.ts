// Seeds the demo circle into the real database (Neon) for the video, with a real sandbox invoice for Hessa.
// Paying that invoice as the sandbox buyer fires the real webhook and completes the pot; approving pays Huda for real.
// Run from apps/api, with the database and PayPal settings loaded:
//   npx tsx --env-file=../../.env.local --env-file=../../../paypal-spike/.env scripts/seed-demo.ts
import pg from "pg";
import { PayPalClient } from "../src/engine/paypal-client";
import { pgDb } from "../src/store/db";
import { seedDemoCircle } from "./demo-seed";

const BUYER = process.env.DEMO_BUYER_EMAIL ?? "sb-0gv2053471726@personal.example.com";
const HOST = process.env.DEMO_HOST_EMAIL ?? "sb-pqh9w53471606@personal.example.com";
const BASE_URL = process.env.DEMO_BASE_URL ?? "https://altin-ub0c.onrender.com";

const databaseUrl = process.env.DATABASE_URL;
const organizerEmail = process.env.ORGANIZER_EMAIL ?? "sb-nrjq251899967@business.example.com";
if (!databaseUrl) throw new Error("DATABASE_URL must be set");

const pool = new pg.Pool({ connectionString: databaseUrl });
const paypal = PayPalClient.fromEnv();

try {
  const { circleId, openInvoiceId } = await seedDemoCircle(pgDb(pool), {
    organizerEmail,
    emails: { Hessa: BUYER, Huda: HOST },
    async sendOpenInvoice({ email, amountCents, requestId }) {
      const invoiceId = await paypal.createInvoice({
        requestId,
        recipientEmail: email,
        amountCents,
        itemName: "Al-Noor circle: gathering 4 (Huda)",
        note: "Your payback to Huda for gathering 4. Thank you!",
      });
      await paypal.sendInvoice(invoiceId);
      return invoiceId;
    },
  });
  console.log("Hessa's invoice:", openInvoiceId);
  console.log("circle page:", `${BASE_URL}/circles/${circleId}`);
} finally {
  await pool.end();
}
