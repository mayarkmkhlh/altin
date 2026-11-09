import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = new URL("../../migrations/", import.meta.url);

// A real Postgres engine in memory with every migration applied, fresh for each test.
export async function testDb(): Promise<PGlite> {
  const db = new PGlite();
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(await readFile(new URL(file, MIGRATIONS_DIR), "utf8"));
  }
  return db;
}
