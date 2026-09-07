import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { PgDialect } from "drizzle-orm/pg-core";
import { evaluationVersionMetricsQuery, summarizeEvaluationVersions, type EvaluationVersionRow } from "../lib/evaluation-version-metrics";

// Explicit opt-in; all fixtures live in pg_temp inside a rolled-back transaction.
// Search-path isolation prevents the test from reading or writing product tables.
if (process.env.METRICS_TEMP_TABLE_TEST !== "1" || !process.env.DATABASE_URL) {
  throw new Error("Use test:metrics:postgres with a configured PostgreSQL connection");
}

test("PostgreSQL version cohorts preserve history, deduplicate latest and enforce time boundaries", async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 });
  const now = new Date("2026-09-08T00:00:00Z");
  const query = new PgDialect().sqlToQuery(evaluationVersionMetricsQuery(now));
  const run = () => client.query<EvaluationVersionRow>(query.sql, query.params);
  let transactionOpen = false;
  try {
    await client.connect();
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query("SET LOCAL search_path = pg_temp");
    await client.query("SET LOCAL statement_timeout = 10000");
    await client.query("CREATE TEMP TABLE skills (id text PRIMARY KEY, status text) ON COMMIT DROP");
    await client.query("CREATE TEMP TABLE evaluations (id text PRIMARY KEY, skill_id text, evaluated_at timestamptz, report jsonb) ON COMMIT DROP");
    assert.equal((await run()).rows.length, 0);
    await client.query("INSERT INTO pg_temp.skills VALUES ('a','active'),('b','active'),('c','active'),('d','inactive'),('f','active'),('g','active')");
    const day = 86_400_000;
    for (const [id, skill, age, version] of [
      ["01", "a", 2 * day, "3.10.0"],
      ["02", "a", 3_600_000, "3.11.0"],
      ["03", "a", 3_600_000, "3.12.0"],
      ["04", "b", 7 * day, null],
      ["05", "c", 30 * day, "3.9.0"],
      ["06", "c", null, "3.0.0"],
      ["07", "d", 0, "3.12.0"],
      ["08", "f", -day, "9.0.0"],
      ["09", "g", day, "untrusted-version-metadata"],
    ] as const) {
      await client.query("INSERT INTO pg_temp.evaluations VALUES ($1,$2,$3,$4)",
        [id, skill, age === null ? null : new Date(now.getTime() - age).toISOString(), JSON.stringify({ version })]);
    }
    const metrics = summarizeEvaluationVersions((await run()).rows, "3.12.0", 5);
    assert.equal(metrics.latestReports, 5, "only active skills, one latest report each");
    assert.equal(metrics.currentVersionLatestReports, 1, "timestamp ties use descending id");
    assert.equal(metrics.otherVersionLatestReports, 2);
    assert.equal(metrics.unversionedLatestReports, 2);
    assert.equal(metrics.currentVersionCoverage, 20);
    const byVersion = (version: string | null) => metrics.versions.find((row) => row.version === version)!;
    assert.equal(byVersion("3.11.0").latestReports, 0);
    assert.equal(byVersion("3.11.0").reports1d, 1, "superseded report remains in output cohort");
    assert.deepEqual(byVersion(null), { version: null, latestReports: 2, reports1d: 1, reports7d: 2, reports30d: 2 });
    assert.equal(byVersion("3.9.0").reports30d, 1, "inclusive lower boundary");
    assert.equal(byVersion("9.0.0").reports1d, 0, "future timestamps do not inflate recent output");
    assert.equal(byVersion("3.0.0").latestReports, 0, "null timestamp must not win latest selection");
    assert.ok(!JSON.stringify(metrics).includes("untrusted-version-metadata"));
  } finally {
    try { if (transactionOpen) await client.query("ROLLBACK"); } finally { await client.end(); }
  }
});
