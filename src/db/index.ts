import * as schema from "./schema";
import type { PgDatabase } from "drizzle-orm/pg-core";

// Production: Neon (DATABASE_URL from the Vercel Neon integration), over HTTP.
// Local dev and tests: an embedded PGlite database in ./.pglite when DATABASE_URL is not set.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = PgDatabase<any, typeof schema>;

const g = globalThis as unknown as { __db?: DB; __dbKind?: "neon" | "pg" | "pglite" };

async function create(): Promise<{ db: DB; kind: "neon" | "pg" | "pglite" }> {
  const url = process.env.DATABASE_URL;
  if (url && url.startsWith("postgres") && !url.includes("neon.tech")) {
    // Supabase (or any standard Postgres). prepare:false is required for Supabase's transaction pooler (port 6543).
    const postgres = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    return { db: drizzle(postgres(url, { prepare: false, max: 5, connect_timeout: 10, idle_timeout: 20 }), { schema }) as unknown as DB, kind: "pg" };
  }
  if (url && url.startsWith("postgres")) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    return { db: drizzle(neon(url), { schema }) as unknown as DB, kind: "neon" };
  }
  if (process.env.VERCEL) throw new Error("DATABASE_URL is not set. Add your Supabase Transaction pooler URI in Vercel → Settings → Environment Variables, then redeploy.");
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

/** Applies any migration not yet recorded in sh_migrations. Migrations are embedded at build time (scripts/embed.ts). */
export async function migrateDb() {
  const db = await getDb();
  const { sql } = await import("drizzle-orm");
  const { MIGRATIONS } = await import("@/generated/migrations");
  await db.execute(sql.raw(`create table if not exists sh_migrations (tag text primary key, applied_at timestamptz default now())`));
  const done = await db.execute(sql.raw(`select tag from sh_migrations`));
  const rows = ("rows" in (done as object) ? (done as unknown as { rows: { tag: string }[] }).rows : (done as unknown as { tag: string }[]));
  const applied = new Set(rows.map((r) => r.tag));
  for (const m of MIGRATIONS) {
    if (applied.has(m.tag)) continue;
    for (const stmt of m.sql.split("--> statement-breakpoint").map((x) => x.trim()).filter(Boolean)) {
      await db.execute(sql.raw(stmt));
    }
    await db.execute(sql`insert into sh_migrations (tag) values (${m.tag})`);
  }
}

export { schema };
