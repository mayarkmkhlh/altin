import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { museSparkModel } from "./agent/model";
import { createApp } from "./app";
import { pool } from "./db";
import { PayPalClient } from "./engine/paypal-client";
import { CircleStore } from "./store/circle-store";
import { pgDb } from "./store/db";

const PORT = Number(process.env.PORT ?? 3000);
// serveStatic paths are relative to the working directory, which is apps/api.
const WEB_DIST = "../web/dist";

let paypal: PayPalClient | undefined;

const app = createApp({
  store: new CircleStore(pgDb(pool)),
  paypal: () => (paypal ??= PayPalClient.fromEnv()),
  model: museSparkModel,
  organizerEmail: process.env.ORGANIZER_EMAIL ?? "organizer@altin.example",
  listTables: async () => {
    const { rows } = await pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    return rows.map((row) => row.table_name);
  },
});

app.use("/*", serveStatic({ root: WEB_DIST }));
app.get("*", serveStatic({ path: `${WEB_DIST}/index.html` }));

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`altin api listening on port ${info.port}`);
});
