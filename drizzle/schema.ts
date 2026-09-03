import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 500 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "instructor", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const qualifications = mysqlTable("qualifications", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const qualificationLevels = mysqlTable("qualificationLevels", {
  id: int("id").autoincrement().primaryKey(),
  qualificationId: int("qualificationId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  sequence: int("sequence").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  qualificationId: int("qualificationId"),
  title: varchar("title", { length: 240 }).notNull(),
  category: mysqlEnum("category", ["course", "case_study", "objective_test", "resource", "marking"]).notNull(),
  description: text("description"),
  featuredImageUrl: text("featuredImageUrl"),
  priceCents: int("priceCents").default(0).notNull(),
  accessDays: int("accessDays").default(30).notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("published").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const entitlements = mysqlTable("entitlements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productId: int("productId").notNull(),
  source: mysqlEnum("source", ["purchase", "admin", "subscription", "free"]).default("purchase").notNull(),
  status: mysqlEnum("status", ["active", "expired", "revoked"]).default("active").notNull(),
  grantedBy: int("grantedBy"),
  startsAt: timestamp("startsAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const resources = mysqlTable("resources", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId"),
  title: varchar("title", { length: 240 }).notNull(),
  kind: mysqlEnum("kind", ["pre_seen", "formulae", "printable_pdf", "feedback", "course_material", "reference"]).notNull(),
  fileKey: varchar("fileKey", { length: 500 }),
  fileUrl: text("fileUrl"),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("published").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const mockExams = mysqlTable("mockExams", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  examType: mysqlEnum("examType", ["case_study", "objective_test"]).notNull(),
  intro: text("intro"),
  totalDurationSeconds: int("totalDurationSeconds").default(2700).notNull(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("published").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const caseStudySections = mysqlTable("caseStudySections", {
  id: int("id").autoincrement().primaryKey(),
  mockExamId: int("mockExamId").notNull(),
  sectionNumber: int("sectionNumber").notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  introduction: text("introduction"),
  scenario: text("scenario"),
  question: text("question"),
  durationSeconds: int("durationSeconds").default(2700).notNull(),
  cooldownSeconds: int("cooldownSeconds").default(30).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const attempts = mysqlTable("attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  mockExamId: int("mockExamId").notNull(),
  mode: mysqlEnum("mode", ["interactive", "printable", "solutions", "feedback"]).notNull(),
  status: mysqlEnum("status", ["not_started", "in_progress", "submitted", "awaiting_marking", "marked", "expired", "cancelled"]).default("not_started").notNull(),
  currentSection: int("currentSection").default(1).notNull(),
  startedAt: timestamp("startedAt"),
  submittedAt: timestamp("submittedAt"),
  contentVersion: varchar("contentVersion", { length: 64 }).default("v1").notNull(),
  optOutOfMarking: int("optOutOfMarking").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const answers = mysqlTable("answers", {
  id: int("id").autoincrement().primaryKey(),
  attemptId: int("attemptId").notNull(),
  sectionId: int("sectionId").notNull(),
  body: text("body").default("").notNull(),
  wordCount: int("wordCount").default(0).notNull(),
  savedAt: timestamp("savedAt").defaultNow().notNull(),
  version: int("version").default(1).notNull(),
});

export const objectiveQuestions = mysqlTable("objectiveQuestions", {
  id: int("id").autoincrement().primaryKey(),
  mockExamId: int("mockExamId").notNull(),
  topic: varchar("topic", { length: 180 }).notNull(),
  learningOutcome: varchar("learningOutcome", { length: 180 }),
  questionType: mysqlEnum("questionType", ["single_choice", "multiple_choice", "dropdown", "numerical", "text_input"]).notNull(),
  prompt: text("prompt").notNull(),
  optionsJson: text("optionsJson").notNull(),
  answerJson: text("answerJson").notNull(),
  attachmentUrl: text("attachmentUrl"),
  attachmentFileName: varchar("attachmentFileName", { length: 240 }),
  attachmentMimeType: varchar("attachmentMimeType", { length: 120 }),
  explanation: text("explanation"),
  rationaleJson: text("rationaleJson"),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).default("medium").notNull(),
  status: mysqlEnum("status", ["draft", "published", "retired"]).default("published").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const submissions = mysqlTable("submissions", {
  id: int("id").autoincrement().primaryKey(),
  attemptId: int("attemptId").notNull(),
  submittedBy: int("submittedBy").notNull(),
  status: mysqlEnum("status", ["locked", "received", "under_review", "released"]).default("locked").notNull(),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  releasedAt: timestamp("releasedAt"),
});

export const feedbackStates = mysqlTable("feedbackStates", {
  id: int("id").autoincrement().primaryKey(),
  attemptId: int("attemptId").notNull(),
  state: mysqlEnum("state", ["not_available", "awaiting_marking", "in_progress", "available"]).default("not_available").notNull(),
  summary: text("summary"),
  fileKey: varchar("fileKey", { length: 500 }),
  fileUrl: text("fileUrl"),
  releasedAt: timestamp("releasedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const markings = mysqlTable("markings", {
  id: int("id").autoincrement().primaryKey(),
  attemptId: int("attemptId").notNull(),
  markerId: int("markerId"),
  status: mysqlEnum("status", ["unassigned", "assigned", "in_progress", "submitted"]).default("unassigned").notNull(),
  totalPoints: int("totalPoints").default(0).notNull(),
  awardedPoints: int("awardedPoints").default(0).notNull(),
  feedback: text("feedback"),
  rubricSnapshot: text("rubricSnapshot"),
  markedAt: timestamp("markedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["account", "purchase", "submission", "marking"]).notNull(),
  subject: varchar("subject", { length: 240 }).notNull(),
  body: text("body").notNull(),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const auditEvents = mysqlTable("auditEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: int("entityId"),
  action: varchar("action", { length: 100 }).notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const paymentGatewaySettings = mysqlTable("paymentGatewaySettings", {
  id: int("id").autoincrement().primaryKey(),
  provider: varchar("provider", { length: 40 }).default("payfast").notNull(),
  mode: mysqlEnum("mode", ["sandbox", "live"]).default("sandbox").notNull(),
  updatedBy: int("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  productId: int("productId").notNull(),
  provider: mysqlEnum("provider", ["payfast", "stripe", "admin"]).notNull(),
  reference: varchar("reference", { length: 120 }),
  amountCents: int("amountCents").default(0).notNull(),
  currency: varchar("currency", { length: 12 }).default("ZAR").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "cancelled", "refunded"]).default("completed").notNull(),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type MockExam = typeof mockExams.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type Answer = typeof answers.$inferSelect;
