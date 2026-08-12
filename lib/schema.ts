// Drizzle schema - PostgreSQL
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  date,
  decimal,
  jsonb,
  pgEnum,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const skillTypeEnum = pgEnum("skill_type", [
  "claude-skill",
  "mcp-server",
  "agent-pack",
]);

export const skillStatusEnum = pgEnum("skill_status", [
  "active",
  "archived",
  "removed",
]);

export const skillSourceEnum = pgEnum("skill_source", [
  "official",
  "github",
  "npm",
  "pypi",
  "manual",
]);

export const rankingPeriodEnum = pgEnum("ranking_period", [
  "daily",
  "weekly",
  "monthly",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "running",
  "done",
  "failed",
]);

// ===== skills =====
export const skills = pgTable(
  "skills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    type: skillTypeEnum("type").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    tags: text("tags").array().default([]),
    category: text("category"),

    source: skillSourceEnum("source"),
    repoUrl: text("repo_url"),
    packageUrl: text("package_url"),
    homepageUrl: text("homepage_url"),

    authorName: text("author_name"),
    authorAvatar: text("author_avatar"),
    authorUrl: text("author_url"),

    license: text("license"),
    currentVersion: text("current_version"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow(),
    lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).defaultNow(),
    lastIndexedAt: timestamp("last_indexed_at", { withTimezone: true }),

    githubStars: integer("github_stars").default(0),
    githubForks: integer("github_forks").default(0),
    githubWatchers: integer("github_watchers").default(0),
    githubOpenIssues: integer("github_open_issues").default(0),
    githubLastCommit: timestamp("github_last_commit", { withTimezone: true }),
    npmDownloadsWeekly: integer("npm_downloads_weekly").default(0),
    pypiDownloadsWeekly: integer("pypi_downloads_weekly").default(0),

    status: skillStatusEnum("status").default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    slugIdx: index("skills_slug_idx").on(t.slug),
    typeIdx: index("skills_type_idx").on(t.type),
    categoryIdx: index("skills_category_idx").on(t.category),
    statusIdx: index("skills_status_idx").on(t.status),
    starsIdx: index("skills_stars_idx").on(t.githubStars),
  })
);

// ===== evaluations =====
export const evaluations = pgTable(
  "evaluations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),

    overallScore: integer("overall_score").notNull(),

    documentationScore: integer("documentation_score").notNull(),
    securityScore: integer("security_score").notNull(),
    popularityScore: integer("popularity_score").notNull(),
    activityScore: integer("activity_score").notNull(),
    qualityScore: integer("quality_score").notNull(),

    report: jsonb("report").notNull(),

    evaluatedBy: text("evaluated_by").notNull(),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    skillIdx: index("evaluations_skill_idx").on(t.skillId),
    overallIdx: index("evaluations_overall_idx").on(t.overallScore),
  })
);

// ===== metrics_daily =====
export const metricsDaily = pgTable(
  "metrics_daily",
  {
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    date: date("date").notNull(),

    githubStars: integer("github_stars").default(0),
    githubStarsDelta: integer("github_stars_delta").default(0),
    githubForks: integer("github_forks").default(0),
    githubOpenIssues: integer("github_open_issues").default(0),
    npmDownloadsWeekly: integer("npm_downloads_weekly").default(0),
    pypiDownloadsWeekly: integer("pypi_downloads_weekly").default(0),

    hotScore: decimal("hot_score", { precision: 10, scale: 4 }).default("0"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.skillId, t.date] }),
    dateIdx: index("metrics_daily_date_idx").on(t.date),
    hotIdx: index("metrics_daily_hot_idx").on(t.hotScore),
  })
);

// ===== rankings =====
export const rankings = pgTable(
  "rankings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    period: rankingPeriodEnum("period").notNull(),
    date: date("date").notNull(),
    rank: integer("rank").notNull(),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    score: decimal("score", { precision: 10, scale: 4 }).notNull(),
  },
  (t) => ({
    periodDateIdx: index("rankings_period_date_idx").on(t.period, t.date, t.rank),
  })
);

// ===== evaluation_jobs =====
export const evaluationJobs = pgTable("evaluation_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  skillId: uuid("skill_id")
    .notNull()
    .references(() => skills.id, { onDelete: "cascade" }),
  status: jobStatusEnum("status").default("pending"),
  triggeredBy: text("triggered_by"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ===== Relations =====
export const skillsRelations = relations(skills, ({ many, one }) => ({
  evaluations: many(evaluations),
  metrics: many(metricsDaily),
  rankings: many(rankings),
  jobs: many(evaluationJobs),
}));

export const evaluationsRelations = relations(evaluations, ({ one }) => ({
  skill: one(skills, {
    fields: [evaluations.skillId],
    references: [skills.id],
  }),
}));
