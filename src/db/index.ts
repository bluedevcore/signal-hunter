import * as schema from "./schema";
import type { PgDatabase } from "drizzle-orm/pg-core";

// Production: Neon (DATABASE_URL from the Vercel Neon integration), over HTTP.
// Local dev and tests: an embedded PGlite database in ./.pglite when DATABASE_URL is not set.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = PgDatabase<any, typeof schema>;

const g = globalThis as unknown as { __db?: DB; __dbKind?: "neon" | "pglite" };

async function create(): Promise<{ db: DB; kind: "neon" | "pglite" }> {
  const url = process.env.DATABASE_URL;
  if (url && url.startsWith("postgres")) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    return { db: drizzle(neon(url), { schema }) as unknown as DB, kind: "neon" };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite(process.env.PGLITE_DIR || "./.pglite");
  return { db: drizzle(client, { schema }) as unknown as DB, kind: "pglite" };
}

export async function getDb(): Promise<DB> {
  if (!g.__db) {
    const { db, kind } = await create();
    g.__db = db;
    g.__dbKind = kind;
  }
  return g.__db;
}

export async function migrateDb() {
  const db = await getDb();
  if (g.__dbKind === "neon") {
    const { migrate } = await import("drizzle-orm/neon-http/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: "./drizzle" });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: "./drizzle" });
  }
}

export { schema };
