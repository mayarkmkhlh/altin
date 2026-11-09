import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { pool } from "./db";

const PORT = Number(process.env.PORT ?? 3000);
// serveStatic paths are relative to the working directory, which is apps/api.
const WEB_DIST = "../web/dist";

const app = new Hono();

app.get("/api/health", async (c) => {
  try {
    const { rows } = await pool.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    return c.json({ ok: true, db: "connected", tables: rows.map((row) => row.table_name) });
  } catch (err) {
    console.error(err);
    return c.json({ ok: false, db: "unreachable" }, 503);
  }
});

app.use("/*", serveStatic({ root: WEB_DIST }));
app.get("*", serveStatic({ path: `${WEB_DIST}/index.html` }));

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`altin api listening on port ${info.port}`);
});
