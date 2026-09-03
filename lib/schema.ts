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
  boolean,
  bigint,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

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

export const billingPlanEnum = pgEnum("billing_plan", ["free", "pro"]);

export const billingStatusEnum = pgEnum("billing_status", [
  "active",
  "past_due",
  "canceled",
  "expired",
]);

export const quotaSubjectEnum = pgEnum("quota_subject", ["user", "network"]);

export const userRoleEnum = pgEnum("user_role", ["user", "super_admin"]);

// ===== authentication =====
// Better Auth core tables. Text IDs are intentional: the auth library owns
// their generation, while product entities continue using PostgreSQL UUIDs.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRoleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  roleIdx: index("user_role_idx").on(t.role),
}));

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (t) => ({
  userIdIdx: index("session_user_id_idx").on(t.userId),
  expiresAtIdx: index("session_expires_at_idx").on(t.expiresAt),
}));

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdIdx: index("account_user_id_idx").on(t.userId),
  providerAccountUniqueIdx: uniqueIndex("account_provider_account_unique_idx").on(t.providerId, t.accountId),
}));

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  identifierIdx: index("verification_identifier_idx").on(t.identifier),
}));

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// Privacy-preserving traffic telemetry. Only daily aggregate counters are
// stored: no IP address, cookie identifier, full referrer URL or user agent.
export const trafficDaily = pgTable("traffic_daily", {
  date: date("date").notNull(),
  path: text("path").notNull(),
  source: text("source").notNull(),
  pageViews: integer("page_views").notNull().default(0),
  evaluationCtaClicks: integer("evaluation_cta_clicks").notNull().default(0),
  guideContinuationClicks: integer("guide_continuation_clicks").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.date, t.path, t.source] }),
  dateIdx: index("traffic_daily_date_idx").on(t.date),
  sourceDateIdx: index("traffic_daily_source_date_idx").on(t.source, t.date),
}));

// Paid entitlements are deliberately separate from the auth user record.
// A payment webhook can update this table transactionally without coupling
// Better Auth migrations to the billing provider chosen later.
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  plan: billingPlanEnum("plan").notNull().default("pro"),
  status: billingStatusEnum("status").notNull().default("active"),
  weeklyEvaluationLimit: integer("weekly_evaluation_limit").notNull().default(100),
  provider: text("provider"),
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userUniqueIdx: uniqueIndex("subscriptions_user_unique_idx").on(t.userId),
  providerSubscriptionUniqueIdx: uniqueIndex("subscriptions_provider_subscription_unique_idx")
    .on(t.provider, t.providerSubscriptionId),
  statusPeriodIdx: index("subscriptions_status_period_idx").on(t.status, t.currentPeriodEnd),
}));

// This is an append-by-period usage ledger rather than a mutable counter on
// users. It supports audits, plan changes and atomic quota reservation.
export const evaluationQuotaUsage = pgTable("evaluation_quota_usage", {
  subjectType: quotaSubjectEnum("subject_type").notNull(),
  subjectKey: text("subject_key").notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  quotaLimit: integer("quota_limit").notNull(),
  used: integer("used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.subjectType, t.subjectKey, t.periodStart] }),
  periodEndIdx: index("evaluation_quota_usage_period_end_idx").on(t.periodEnd),
}));

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

// README snapshots live outside the hot skills row. This keeps collection,
// ranking and snapshot queries small even when a README reaches the cache cap.
export const skillReadmes = pgTable("skill_readmes", {
  skillId: uuid("skill_id")
    .primaryKey()
    .references(() => skills.id, { onDelete: "cascade" }),
  readmeContent: text("content"),
  readmePath: text("path"),
  readmeHtmlUrl: text("html_url"),
  readmeRawUrl: text("raw_url"),
  readmeCachedAt: timestamp("cached_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  cachedAtIdx: index("skill_readmes_cached_at_idx").on(t.readmeCachedAt),
}));

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
    periodDateRankUniqueIdx: uniqueIndex("rankings_period_date_rank_unique_idx").on(t.period, t.date, t.rank),
    periodDateSkillUniqueIdx: uniqueIndex("rankings_period_date_skill_unique_idx").on(t.period, t.date, t.skillId),
  })
);

// ===== evaluation_jobs =====
export const evaluationJobs = pgTable("evaluation_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  skillId: uuid("skill_id")
    .notNull()
    .references(() => skills.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  status: jobStatusEnum("status").default("pending"),
  triggeredBy: text("triggered_by"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  error: text("error"),
  attempt: integer("attempt").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  progress: integer("progress").notNull().default(0),
  stage: text("stage").notNull().default("queued"),
  forceRefresh: boolean("force_refresh").notNull().default(false),
  quotaPeriodStart: date("quota_period_start"),
  quotaUnits: integer("quota_units").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  statusCreatedIdx: index("evaluation_jobs_status_created_idx").on(t.status, t.createdAt),
  skillStatusIdx: index("evaluation_jobs_skill_status_idx").on(t.skillId, t.status),
  userCreatedIdx: index("evaluation_jobs_user_created_idx").on(t.userId, t.createdAt),
  oneActivePerSkillIdx: uniqueIndex("evaluation_jobs_one_active_per_skill_idx")
    .on(t.skillId)
    .where(sql`${t.status} in ('pending', 'running')`),
}));

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  evaluationJobs: many(evaluationJobs),
  subscriptions: many(subscriptions),
}));

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  user: one(user, { fields: [subscriptions.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

// ===== Relations =====
export const skillsRelations = relations(skills, ({ many, one }) => ({
  evaluations: many(evaluations),
  metrics: many(metricsDaily),
  rankings: many(rankings),
  jobs: many(evaluationJobs),
  readme: one(skillReadmes, { fields: [skills.id], references: [skillReadmes.skillId] }),
}));

export const skillReadmesRelations = relations(skillReadmes, ({ one }) => ({
  skill: one(skills, { fields: [skillReadmes.skillId], references: [skills.id] }),
}));

export const evaluationsRelations = relations(evaluations, ({ one }) => ({
  skill: one(skills, {
    fields: [evaluations.skillId],
    references: [skills.id],
  }),
}));
