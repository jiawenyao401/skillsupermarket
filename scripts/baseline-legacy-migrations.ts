import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const BASELINE_TAG = "0004_super_admin";
const BASELINE_FILE = `drizzle/${BASELINE_TAG}.sql`;
const BASELINE_LOCK = 2_140_828_004;

const REQUIRED_TABLES = [
  "evaluation_jobs",
  "rankings",
  "account",
  "rate_limit",
  "session",
  "user",
  "verification",
  "subscriptions",
  "evaluation_quota_usage",
] as const;

const REQUIRED_COLUMNS = [
  ["evaluation_jobs", "attempt"],
  ["evaluation_jobs", "max_attempts"],
  ["evaluation_jobs", "progress"],
  ["evaluation_jobs", "stage"],
  ["evaluation_jobs", "force_refresh"],
  ["evaluation_jobs", "user_id"],
  ["evaluation_jobs", "quota_period_start"],
  ["evaluation_jobs", "quota_units"],
  ["user", "role"],
] as const;

const REQUIRED_INDEXES = [
  "evaluation_jobs_status_created_idx",
  "evaluation_jobs_skill_status_idx",
  "evaluation_jobs_one_active_per_skill_idx",
  "rankings_period_date_rank_unique_idx",
  "rankings_period_date_skill_unique_idx",
  "account_user_id_idx",
  "account_provider_account_unique_idx",
  "session_user_id_idx",
  "session_expires_at_idx",
  "verification_identifier_idx",
  "evaluation_jobs_user_created_idx",
  "subscriptions_user_unique_idx",
  "subscriptions_provider_subscription_unique_idx",
  "subscriptions_status_period_idx",
  "evaluation_quota_usage_period_end_idx",
  "user_role_idx",
] as const;

const REQUIRED_TYPES = ["billing_plan", "billing_status", "quota_subject", "user_role"] as const;
const REQUIRED_CONSTRAINTS = [
  "account_user_id_user_id_fk",
  "session_user_id_user_id_fk",
  "evaluation_jobs_user_id_user_id_fk",
  "evaluation_jobs_quota_units_check",
] as const;

interface Journal {
  entries: Array<{ tag: string; when: number }>;
}

function missing(expected: readonly string[], actual: Set<string>): string[] {
  return expected.filter((value) => !actual.has(value));
}

async function main() {
  if (process.env.MIGRATION_BASELINE_APPROVED !== "1") {
    throw new Error("拒绝自动信任历史数据库；核对 0000-0004 已实际应用后设置 MIGRATION_BASELINE_APPROVED=1");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 未配置");

  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as Journal;
  const baselineEntry = journal.entries.find((entry) => entry.tag === BASELINE_TAG);
  if (!baselineEntry) throw new Error(`迁移日志缺少 ${BASELINE_TAG}`);
  const migrationSql = await readFile(path.resolve(BASELINE_FILE), "utf8");
  const migrationHash = createHash("sha256").update(migrationSql).digest("hex");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock($1)", [BASELINE_LOCK]);
    await client.query("create schema if not exists drizzle");
    await client.query(`
      create table if not exists drizzle.__drizzle_migrations (
        id serial primary key,
        hash text not null,
        created_at bigint
      )
    `);
    const ledger = await client.query<{ count: number; latest: string | null }>(`
      select count(*)::int as count, max(created_at)::text as latest
      from drizzle.__drizzle_migrations
    `);
    const ledgerCount = ledger.rows[0]?.count ?? 0;
    const latest = Number(ledger.rows[0]?.latest ?? 0);
    if (latest >= baselineEntry.when) {
      await client.query("rollback");
      console.log(JSON.stringify({ status: "already-baselined", baseline: BASELINE_TAG }));
      return;
    }
    if (ledgerCount !== 0) {
      throw new Error(`迁移账本已有 ${ledgerCount} 条较早记录；拒绝猜测部分迁移状态`);
    }

    // A single pg Client executes one query at a time. Keep these sequential so
    // this safety gate remains compatible with pg 9, which rejects overlapping
    // client.query() calls instead of queueing them.
    const tables = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = current_schema()",
    );
    const columns = await client.query<{ table_name: string; column_name: string }>(
      "select table_name, column_name from information_schema.columns where table_schema = current_schema()",
    );
    const indexes = await client.query<{ indexname: string }>(
      "select indexname from pg_indexes where schemaname = current_schema()",
    );
    const types = await client.query<{ typname: string }>(
      "select typname from pg_type join pg_namespace on pg_namespace.oid = pg_type.typnamespace where nspname = current_schema()",
    );
    const constraints = await client.query<{ constraint_name: string }>(
      "select constraint_name from information_schema.table_constraints where constraint_schema = current_schema()",
    );
    const absent = {
      tables: missing(REQUIRED_TABLES, new Set(tables.rows.map((row) => row.table_name))),
      columns: missing(
        REQUIRED_COLUMNS.map(([table, column]) => `${table}.${column}`),
        new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`)),
      ),
      indexes: missing(REQUIRED_INDEXES, new Set(indexes.rows.map((row) => row.indexname))),
      types: missing(REQUIRED_TYPES, new Set(types.rows.map((row) => row.typname))),
      constraints: missing(REQUIRED_CONSTRAINTS, new Set(constraints.rows.map((row) => row.constraint_name))),
    };
    const absentCount = Object.values(absent).reduce((sum, values) => sum + values.length, 0);
    if (absentCount > 0) throw new Error(`历史迁移对象不完整：${JSON.stringify(absent)}`);

    await client.query(
      "insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)",
      [migrationHash, baselineEntry.when],
    );
    await client.query("commit");
    const verifiedObjects = REQUIRED_TABLES.length + REQUIRED_COLUMNS.length + REQUIRED_INDEXES.length +
      REQUIRED_TYPES.length + REQUIRED_CONSTRAINTS.length;
    console.log(JSON.stringify({ status: "baselined", baseline: BASELINE_TAG, verifiedObjects }));
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[migration-baseline] 失败", error instanceof Error ? error.message : error);
  process.exit(1);
});
