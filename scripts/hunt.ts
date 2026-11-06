// Run a hunt (or backfill) to completion from the command line: pnpm hunt [--backfill]
import { migrateDb } from "../src/db";
import { startBackfill, startHunt, tick } from "../src/lib/hunt/engine";

async function main() {
  await migrateDb();
  const run = process.argv.includes("--backfill") ? await startBackfill(true) : await startHunt("manual");
  console.log("run", run.id, run.kind);
  for (let i = 0; i < 500; i++) {
    const { run: r, message } = await tick(45_000);
    console.log(new Date().toISOString().slice(11, 19), r?.phase, message, JSON.stringify(r?.counts));
    if (!r || r.status !== "running") break;
    if (message.startsWith("Waiting")) await new Promise((res) => setTimeout(res, 15000));
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
