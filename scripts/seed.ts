import { migrateDb } from "../src/db";
import { seed } from "../src/lib/seed";

async function main() {
  await migrateDb();
  console.log(await seed({ reset: process.argv.includes("--reset") }));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
