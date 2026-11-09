import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// TLS comes from the URL itself: Neon's connection string ends in ?sslmode=require.
export const pool = new pg.Pool({ connectionString });
