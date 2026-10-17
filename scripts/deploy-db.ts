// Brings a hosted (Turso) database up to date: applies any migrations it
// hasn't had yet, then loads the exercise library. Safe to run any number of
// times; it never deletes accounts. Prisma's own migrate command can't reach
// Turso, so this applies the same migration files itself.
//
// Run with: npm run db:deploy   (reads .env.turso, or the environment)
//           npm run db:deploy -- --check   (only lists what would run)
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../src/generated/prisma/client";
import { exerciseToRow } from "../src/lib/db-mapping";
import { migrationStatements } from "../src/lib/migration-sql";
import { EXERCISES } from "../src/lib/exercise-library";

if (existsSync(".env.turso")) config({ path: ".env.turso", override: true, quiet: true });
const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;
if (!url) throw new Error("Set DATABASE_URL (and DATABASE_AUTH_TOKEN for Turso) in .env.turso.");
const checkOnly = process.argv.includes("--check");

const MIGRATIONS = "prisma/migrations";

async function main() {
  const client = createClient({ url: url!, authToken });
  await client.execute("CREATE TABLE IF NOT EXISTS _ede_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
  const applied = new Set((await client.execute("SELECT name FROM _ede_migrations")).rows.map((r) => String(r.name)));
  const pending = readdirSync(MIGRATIONS)
    .filter((name) => existsSync(join(MIGRATIONS, name, "migration.sql")))
    .sort()
    .filter((name) => !applied.has(name));

  console.log(`${new URL(url!).host || url}: ${applied.size} migrations applied, ${pending.length} to apply.`);
  for (const name of pending) console.log(`  ${checkOnly ? "would apply" : "applying"} ${name}`);
  if (checkOnly) return;

  for (const name of pending) {
    const sql = readFileSync(join(MIGRATIONS, name, "migration.sql"), "utf8");
    // One transaction per migration: all of it, or none of it.
    await client.migrate([
      ...migrationStatements(sql),
      { sql: "INSERT INTO _ede_migrations (name, applied_at) VALUES (?, ?)", args: [name, new Date().toISOString()] },
    ]);
  }
  client.close();

  const db = new PrismaClient({ adapter: new PrismaLibSql({ url: url!, authToken }) });
  for (const e of EXERCISES) {
    const row = exerciseToRow(e);
    await db.exercise.upsert({ where: { name: e.name }, create: row, update: row });
  }
  await db.$disconnect();
  console.log(`Up to date. Exercise library: ${EXERCISES.length} exercises.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
