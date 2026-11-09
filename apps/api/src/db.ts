import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Render's external URL (used from a laptop) requires TLS; the internal URL used on Render does not.
const isExternalRenderUrl = connectionString.includes(".render.com");

export const pool = new pg.Pool({
  connectionString,
  ssl: isExternalRenderUrl ? { rejectUnauthorized: false } : undefined,
});
