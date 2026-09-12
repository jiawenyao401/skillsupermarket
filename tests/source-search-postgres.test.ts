import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { and, eq, sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { skills } from "../lib/schema";
import { sourceSearchCondition } from "../lib/source-search";

// SELECT-only fixtures shadow the real skills table; no product data is read or written.
if (!process.env.DATABASE_URL) throw new Error("PostgreSQL connection required for source lookup verification");

test("PostgreSQL source lookup excludes inactive and different registry identities", async () => {
  const row = (id: string, source: string | null, name: string, repo_url: string | null, package_url: string | null, status = "active") => ({ id, source, name, repo_url, package_url, status });
  const fixtures = [
    row("github", "github", "Tool", "https://github.com/A/B.C.git", null),
    row("curated", "manual", "Custom name", "https://www.github.com/a/b.c/tree/main", null),
    row("archived", "github", "Tool", "https://github.com/a/b.c", null, "archived"),
    row("removed", "github", "Tool", "https://github.com/a/b.c", null, "removed"),
    row("collision", "github", "a/b.c", "https://github.com/a/bXc", null),
    row("suffix", "github", "Tool", "https://github.com/a/b.c-evil", null),
    row("npm", "npm", "Tool", "https://github.com/a/b.c", "https://www.npmjs.com/package/%40scope%2Ftool/"),
    row("npm-name", "npm", "@scope/tool", null, null),
    row("npm-other", "npm", "@scope/tool", null, "https://www.npmjs.com/package/@other/tool"),
    row("npm-collision", "npm", "scopetool", null, "https://www.npmjs.com/package/scopetool"),
    row("pypi", "pypi", "Readable label", null, "https://pypi.org/project/example.package/"),
    row("pypi-name", "pypi", "Example___Package", null, null),
    row("same-npm-name", "npm", "example-package", null, null),
    row("unknown", null, "Tool", "https://github.com/a/b.c", null),
  ];
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = 5000");
    for (const [input, expected] of [
      ["https://github.com/a/b.c", ["curated", "github", "unknown"]],
      ["@scope/tool", ["npm", "npm-name"]],
      ["pypi:example-package", ["pypi", "pypi-name"]],
      ["https://github.com/a/nonexistent", []],
      ["https://private.invalid/", []],
    ] as const) {
      const query = new PgDialect().sqlToQuery(sql`
        with skills as (
          select * from jsonb_to_recordset(${JSON.stringify(fixtures)}::jsonb)
            as r(id text, source text, name text, repo_url text, package_url text, status text)
        )
        select id from skills where ${and(eq(skills.status, "active"), sourceSearchCondition(input))} order by id
      `);
      const result = await client.query<{ id: string }>(query.sql, query.params);
      assert.deepEqual(result.rows.map(r => r.id), expected);
    }
  } finally {
    try { await client.query("ROLLBACK"); } finally { await client.end(); }
  }
});
