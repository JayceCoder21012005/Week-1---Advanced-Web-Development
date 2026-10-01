/**
 * Quản lý DB: npm run db:migrate | db:seed | db:reset
 *  - migrate: chạy các file db/migrations/*.sql chưa áp dụng (lưu vết trong schema_migrations)
 *  - seed:    nạp db/seed.sql
 *  - reset:   DROP toàn bộ schema public, migrate lại rồi seed
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const root = path.resolve(__dirname, "..");

async function migrate(client: Client) {
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const dir = path.join(root, "db", "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await client.query<{ name: string }>("SELECT name FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.name));
  for (const file of files) {
    if (applied.has(file)) continue;
    await client.query("BEGIN");
    try {
      await client.query(readFileSync(path.join(dir, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`  applied ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }
  console.log("migrate: done");
}

async function seed(client: Client) {
  await client.query(readFileSync(path.join(root, "db", "seed.sql"), "utf8"));
  console.log("seed: done");
}

async function reset(client: Client) {
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  console.log("reset: schema dropped");
  await migrate(client);
  await seed(client);
}

async function main() {
  const cmd = process.argv[2];
  const actions: Record<string, (c: Client) => Promise<void>> = { migrate, seed, reset };
  const action = actions[cmd];
  if (!action) {
    console.error("usage: tsx scripts/db.ts <migrate|seed|reset>");
    process.exit(1);
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await action(client);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
