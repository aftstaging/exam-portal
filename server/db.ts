import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { ENV } from "./_core/env";
import { storageGetSignedUrl, storagePut } from "./storage";
import { generateBrandedPrintablePdf } from "./pdf";
import { hasActiveEntitlement, isAdminRole, isAttemptEditable, isAttemptSubmittable } from "@shared/integrity";
import { entitlementExpiryFromAccessDays } from "@shared/payments";
import {
  answers,
  attempts,
  caseStudySections,
  entitlements,
  mockExams,
  objectiveQuestions,
  payments,
  products,
  qualifications,
  resources,
  markings,
  feedbackStates,
  submissions,
  notifications,
  auditEvents,
  coupons,
  couponRedemptions,
  type InsertUser,
  users,
  paymentGatewaySettings,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) { if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; } }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; } else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.openId, user.openId)).limit(1);
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  if (!existing[0]) {
    const createdUser = await db.select({ id: users.id }).from(users).where(eq(users.openId, user.openId)).limit(1);
    if (createdUser[0]) await db.insert(notifications).values({ userId: createdUser[0].id, type: "account", subject: "Welcome to Accountants for Tomorrow", body: "Your learner account is ready. Explore your products and begin your exam preparation." });
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb(); if (!db) return undefined;
  const normalized = email.trim().toLowerCase();
  const result = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return result[0];
}

export async function createLocalUser(input: { email: string; name?: string; passwordHash: string; role?: "user" | "admin" | "instructor" }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const openId = `local:${randomUUID()}`;
  const email = input.email.trim().toLowerCase();
  const role = input.email.trim().toLowerCase() === ENV.ownerEmail ? "admin" : (input.role ?? "user");
  await db.insert(users).values({
    openId,
    email,
    name: input.name?.trim() || null,
    passwordHash: input.passwordHash,
    loginMethod: "local",
    role,
    lastSignedIn: new Date(),
  });
  const created = await getUserByEmail(email);
  if (!created) throw new Error("User could not be created");
  await db.insert(notifications).values({ userId: created.id, type: "account", subject: "Welcome to Accountants for Tomorrow", body: "Your learner account is ready. Explore your products and begin your exam preparation." });
  return created;
}

export async function updateUserPasswordHash(userId: number, passwordHash: string) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function updateUserLastSignedIn(userId: number) {
  const db = await getDb(); if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export async function provisionDemoLearner(adminUserId: number) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const openId = "aft-demo-learner-60d";
  const email = "demo@accountantsfortomorrow.co.za";
  await upsertUser({ openId, name: "AFT Demo Learner", email, loginMethod: "demo", role: "user", lastSignedIn: new Date() });
  const demoUser = await getUserByOpenId(openId);
  if (!demoUser) throw new Error("Demo learner could not be created");
  const catalogue = await db.select().from(products).where(eq(products.status, "published"));
  const eligible = catalogue.filter((product) => product.category === "case_study" || product.category === "objective_test");
  const existing = await db.select().from(entitlements).where(eq(entitlements.userId, demoUser.id));
  const existingByProductId = new Map(existing.map((item) => [item.productId, item]));
  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + 60 * 24 * 60 * 60 * 1000);
  for (const product of eligible) {
    const current = existingByProductId.get(product.id);
    if (current) {
      await db.update(entitlements).set({ source: "admin", status: "active", startsAt, expiresAt }).where(eq(entitlements.id, current.id));
    } else {
      await db.insert(entitlements).values({ userId: demoUser.id, productId: product.id, source: "admin" as const, status: "active" as const, startsAt, expiresAt });
    }
  }
  await db.insert(auditEvents).values({ userId: adminUserId, entityType: "demo_learner", entityId: demoUser.id, action: "provisioned", metadata: JSON.stringify({ openId, productCount: eligible.length, expiresAt: expiresAt.toISOString() }) });
  return { id: demoUser.id, openId, email, name: demoUser.name, productCount: eligible.length, expiresAt };
}

export async function listPublishedProducts() {
  const db = await getDb(); if (!db) return [];
  return db.select({ product: products, qualification: qualifications }).from(products).leftJoin(qualifications, eq(products.qualificationId, qualifications.id)).where(eq(products.status, "published")).orderBy(desc(products.createdAt));
}

export async function listPublishedQualifications() {
  const db = await getDb(); if (!db) return [];
  return db.select().from(qualifications).orderBy(asc(qualifications.name));
}

export async function listPublishedMockExams() {
  const db = await getDb(); if (!db) return [];
  return db.select({ mockExam: mockExams, product: products, qualification: qualifications }).from(mockExams).innerJoin(products, eq(mockExams.productId, products.id)).leftJoin(qualifications, eq(products.qualificationId, qualifications.id)).where(eq(mockExams.status, "published")).orderBy(desc(mockExams.createdAt));
}

export async function listPublishedCaseStudySections(mockExamId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select({ id: caseStudySections.id, mockExamId: caseStudySections.mockExamId, sectionNumber: caseStudySections.sectionNumber, title: caseStudySections.title, introduction: caseStudySections.introduction, durationSeconds: caseStudySections.durationSeconds, cooldownSeconds: caseStudySections.cooldownSeconds }).from(caseStudySections).innerJoin(mockExams, eq(caseStudySections.mockExamId, mockExams.id)).where(and(eq(caseStudySections.mockExamId, mockExamId), eq(mockExams.status, "published"))).orderBy(asc(caseStudySections.sectionNumber));
}

export async function listPublishedObjectiveQuestions(mockExamId?: number) {
  const db = await getDb(); if (!db) return [];
  const conditions = mockExamId ? and(eq(objectiveQuestions.status, "published"), eq(objectiveQuestions.mockExamId, mockExamId)) : eq(objectiveQuestions.status, "published");
  return db.select({ id: objectiveQuestions.id, mockExamId: objectiveQuestions.mockExamId, topic: objectiveQuestions.topic, learningOutcome: objectiveQuestions.learningOutcome, questionType: objectiveQuestions.questionType, prompt: objectiveQuestions.prompt, optionsJson: objectiveQuestions.optionsJson, answerJson: objectiveQuestions.answerJson, explanation: objectiveQuestions.explanation, rationaleJson: objectiveQuestions.rationaleJson, difficulty: objectiveQuestions.difficulty }).from(objectiveQuestions).where(conditions).orderBy(objectiveQuestions.id);
}

export async function listUserEntitlements(userId: number) {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select({ entitlement: entitlements, product: products }).from(entitlements).innerJoin(products, eq(entitlements.productId, products.id)).where(and(eq(entitlements.userId, userId), inArray(entitlements.status, ["active", "expired"]))).orderBy(desc(entitlements.createdAt));
  return rows.map((row) => ({ ...row, entitlement: { ...row.entitlement, status: hasActiveEntitlement(row.entitlement) ? "active" as const : row.entitlement.status === "revoked" ? "revoked" as const : "expired" as const } }));
}

export async function listUserAttempts(userId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select({ attempt: attempts, mockExam: mockExams }).from(attempts).innerJoin(mockExams, eq(attempts.mockExamId, mockExams.id)).where(eq(attempts.userId, userId)).orderBy(desc(attempts.updatedAt));
}

export async function getPayFastGatewaySettings() {
  const db = await getDb();
  const row = db ? (await db.select().from(paymentGatewaySettings).limit(1))[0] : undefined;
  const mode = row?.mode ?? (ENV.payfastMode === "live" ? "live" : "sandbox");
  return { mode, configured: Boolean((mode === "live" ? ENV.payfastLiveMerchantId && ENV.payfastLiveMerchantKey : ENV.payfastSandboxMerchantId && ENV.payfastSandboxMerchantKey)), updatedAt: row?.updatedAt ?? null, updatedBy: row?.updatedBy ?? null };
}

export async function setPayFastGatewayMode(userId: number, mode: "sandbox" | "live") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (mode === "live" && !(ENV.payfastLiveMerchantId && ENV.payfastLiveMerchantKey)) throw new Error("Live PayFast credentials are not configured");
  const existing = (await db.select().from(paymentGatewaySettings).limit(1))[0];
  if (existing) await db.update(paymentGatewaySettings).set({ mode, updatedBy: userId, updatedAt: new Date() }).where(eq(paymentGatewaySettings.id, existing.id));
  else await db.insert(paymentGatewaySettings).values({ provider: "payfast", mode, updatedBy: userId });
  await db.insert(auditEvents).values({ userId, entityType: "payment_gateway", entityId: existing?.id ?? 1, action: "payfast_mode_updated", metadata: JSON.stringify({ mode }) });
  return getPayFastGatewaySettings();
}

export async function getAdminOverview() {
  const db = await getDb();
  if (!db) return { activeLearners: 0, awaitingMarking: 0, publishedProducts: 0, recentActivity: [] };
  const [learnerCount, markingCount, productCount] = await Promise.all([
    db.select({ value: count() }).from(users),
    db.select({ value: count() }).from(attempts).where(eq(attempts.status, "awaiting_marking")),
    db.select({ value: count() }).from(products).where(eq(products.status, "published")),
  ]);
  const recentActivity = await db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(8);
  return {
    activeLearners: Number(learnerCount[0]?.value ?? 0),
    awaitingMarking: Number(markingCount[0]?.value ?? 0),
    publishedProducts: Number(productCount[0]?.value ?? 0),
    recentActivity,
  };
}

export async function startCaseStudyAttempt(input: { userId: number; mockExamId: number; mode: "interactive" | "printable" | "solutions" | "feedback" }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const exam = await db.select({ mockExam: mockExams, product: products }).from(mockExams).innerJoin(products, eq(mockExams.productId, products.id)).where(eq(mockExams.id, input.mockExamId)).limit(1);
  if (!exam[0]) throw new Error("Mock exam not found");
  if ((exam[0].product.priceCents ?? 0) > 0) {
    const access = await db.select().from(entitlements).where(and(eq(entitlements.userId, input.userId), eq(entitlements.productId, exam[0].product.id), eq(entitlements.status, "active"))).limit(1);
    if (!hasActiveEntitlement(access[0])) throw new Error("Active entitlement required");
  }
  const existing = await db.select().from(attempts).where(and(eq(attempts.userId, input.userId), eq(attempts.mockExamId, input.mockExamId), eq(attempts.mode, input.mode), eq(attempts.status, "in_progress"))).limit(1);
  if (existing[0]) return existing[0];
  const created = await db.insert(attempts).values({ userId: input.userId, mockExamId: input.mockExamId, mode: input.mode, status: "in_progress", startedAt: new Date(), currentSection: 1 }).$returningId();
  const row = await db.select().from(attempts).where(eq(attempts.id, created[0]?.id ?? 0)).limit(1);
  return row[0];
}

export async function getAttemptContext(userId: number, attemptId: number) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const rows = await db.select({ attempt: attempts, mockExam: mockExams, product: products }).from(attempts).innerJoin(mockExams, eq(attempts.mockExamId, mockExams.id)).innerJoin(products, eq(mockExams.productId, products.id)).where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId))).limit(1);
  if (!rows[0]) throw new Error("Attempt not found");
  return { mockExamId: rows[0].mockExam.id, productId: rows[0].product.id, status: rows[0].attempt.status };
}

export async function saveAnswerDraft(input: { userId: number; attemptId: number; sectionId: number; body: string; wordCount: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const attempt = await db.select().from(attempts).where(and(eq(attempts.id, input.attemptId), eq(attempts.userId, input.userId))).limit(1);
  if (!attempt[0] || !isAttemptEditable(attempt[0].status)) throw new Error("Attempt is not editable");
  const existing = await db.select().from(answers).where(and(eq(answers.attemptId, input.attemptId), eq(answers.sectionId, input.sectionId))).limit(1);
  if (existing[0]) {
    await db.update(answers).set({ body: input.body, wordCount: input.wordCount, savedAt: new Date(), version: existing[0].version + 1 }).where(eq(answers.id, existing[0].id));
    return { id: existing[0].id, version: existing[0].version + 1, savedAt: new Date() };
  }
  const created = await db.insert(answers).values({ attemptId: input.attemptId, sectionId: input.sectionId, body: input.body, wordCount: input.wordCount }).$returningId();
  return { id: created[0]?.id, version: 1, savedAt: new Date() };
}

export async function submitAttempt(input: { userId: number; attemptId: number; optOutOfMarking: boolean }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const attempt = await db.select().from(attempts).where(and(eq(attempts.id, input.attemptId), eq(attempts.userId, input.userId))).limit(1);
  if (!attempt[0] || attempt[0].status === "submitted" || attempt[0].status === "marked") throw new Error("Attempt cannot be submitted");
  const status = input.optOutOfMarking ? "submitted" : "awaiting_marking";
  await db.update(attempts).set({ status, optOutOfMarking: input.optOutOfMarking ? 1 : 0, submittedAt: new Date() }).where(eq(attempts.id, input.attemptId));
  return { success: true, status };
}

export async function generatePrintablePdf(userId: number, mockExamId: number) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const exam = await db.select({ mockExam: mockExams, product: products }).from(mockExams).innerJoin(products, eq(mockExams.productId, products.id)).where(eq(mockExams.id, mockExamId)).limit(1);
  if (!exam[0]) throw new Error("Mock exam not found");
  const sections = await db.select({ sectionNumber: caseStudySections.sectionNumber, title: caseStudySections.title, durationSeconds: caseStudySections.durationSeconds, introduction: caseStudySections.introduction }).from(caseStudySections).where(eq(caseStudySections.mockExamId, mockExamId)).orderBy(asc(caseStudySections.sectionNumber));
  const bytes = await generateBrandedPrintablePdf(exam[0].mockExam, sections);
  const uploaded = await storagePut(`mock-exams/${mockExamId}/printable-exam.pdf`, bytes, "application/pdf");
  const existing = await db.select().from(resources).where(and(eq(resources.productId, exam[0].product.id), eq(resources.kind, "printable_pdf"))).limit(1);
  if (existing[0]) {
    await db.update(resources).set({ title: `${exam[0].mockExam.title} · Printable exam`, fileKey: uploaded.key, fileUrl: uploaded.url, status: "published" }).where(eq(resources.id, existing[0].id));
    await db.insert(auditEvents).values({ userId, entityType: "resource", entityId: existing[0].id, action: "printable_pdf_regenerated", metadata: JSON.stringify({ mockExamId, resourceId: existing[0].id }) });
    return { resourceId: existing[0].id, url: uploaded.url, regenerated: true };
  }
  const created = await db.insert(resources).values({ productId: exam[0].product.id, title: `${exam[0].mockExam.title} · Printable exam`, kind: "printable_pdf", fileKey: uploaded.key, fileUrl: uploaded.url, status: "published" }).$returningId();
  await db.insert(auditEvents).values({ userId, entityType: "resource", entityId: created[0]?.id ?? 0, action: "printable_pdf_generated", metadata: JSON.stringify({ mockExamId }) });
  return { resourceId: created[0]?.id, url: uploaded.url, regenerated: false };
}

export async function getPrintableExamPdf(userId: number, mockExamId: number) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const exam = await db.select({ mockExam: mockExams, product: products }).from(mockExams).innerJoin(products, eq(mockExams.productId, products.id)).where(eq(mockExams.id, mockExamId)).limit(1);
  if (!exam[0]) throw new Error("Mock exam not found");
  if ((exam[0].product.priceCents ?? 0) > 0) {
    const access = await db.select().from(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.productId, exam[0].product.id), eq(entitlements.status, "active"))).limit(1);
    if (!hasActiveEntitlement(access[0])) throw new Error("Active entitlement required");
  }
  const existing = await db.select().from(resources).where(and(eq(resources.productId, exam[0].product.id), eq(resources.kind, "printable_pdf"))).limit(1);
  if (existing[0]?.fileKey) {
    return { resourceId: existing[0].id, url: await storageGetSignedUrl(existing[0].fileKey), generated: false };
  }
  const generated = await generatePrintablePdf(userId, mockExamId);
  const row = generated.resourceId ? await db.select().from(resources).where(eq(resources.id, generated.resourceId)).limit(1) : existing;
  const key = row[0]?.fileKey;
  if (!key) throw new Error("Printable PDF could not be generated");
  return { resourceId: row[0]?.id, url: await storageGetSignedUrl(key), generated: true };
}

function inferResourceMimeType(fileKey: string | null | undefined): string {
  const ext = (fileKey ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "txt") return "text/plain";
  if (ext === "doc") return "application/msword";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

export async function listProtectedResources(userId: number, productId: number) {
  const db = await getDb(); if (!db) return [];
  const product = await db.select({ priceCents: products.priceCents }).from(products).where(eq(products.id, productId)).limit(1);
  if (!product[0]) throw new Error("Product not found");
  if ((product[0].priceCents ?? 0) > 0) {
    const access = await db.select().from(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.productId, productId), eq(entitlements.status, "active"))).limit(1);
    if (!hasActiveEntitlement(access[0])) throw new Error("Active entitlement required");
  }
  const rows = await db.select().from(resources).where(and(eq(resources.productId, productId), eq(resources.status, "published"))).orderBy(desc(resources.createdAt));
  return rows.map(({ fileKey, fileUrl, ...resource }) => ({ ...resource, hasFile: Boolean(fileKey || fileUrl), mimeType: inferResourceMimeType(fileKey) }));
}

export async function getProtectedResourceDownload(userId: number, resourceId: number) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const row = await db.select({ resource: resources, product: products }).from(resources).innerJoin(products, eq(resources.productId, products.id)).where(and(eq(resources.id, resourceId), eq(resources.status, "published"))).limit(1);
  if (!row[0]?.resource) throw new Error("Resource not found");
  if ((row[0].product.priceCents ?? 0) > 0) {
    const access = await db.select().from(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.productId, row[0].product.id), eq(entitlements.status, "active"))).limit(1);
    if (!hasActiveEntitlement(access[0])) throw new Error("Active entitlement required");
  }
  const key = row[0].resource.fileKey;
  if (!key) throw new Error("This resource is not available for download yet");
  return { id: row[0].resource.id, title: row[0].resource.title, kind: row[0].resource.kind, url: await storageGetSignedUrl(key) };
}

export async function listUserNotifications(userId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(30);
}

export async function markNotificationRead(userId: number, notificationId: number) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
  return { success: true };
}

export async function createLockedSubmission(input: { userId: number; attemptId: number; optOutOfMarking: boolean }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const attempt = await db.select().from(attempts).where(and(eq(attempts.id, input.attemptId), eq(attempts.userId, input.userId))).limit(1);
  if (!attempt[0] || !isAttemptSubmittable(attempt[0].status)) throw new Error("Attempt cannot be submitted");
  const existingSubmission = await db.select().from(submissions).where(eq(submissions.attemptId, input.attemptId)).limit(1);
  if (existingSubmission[0]) throw new Error("Submission is already locked");
  if (!input.optOutOfMarking) {
    const markingProduct = await db.select({ id: products.id }).from(products).where(and(eq(products.category, "marking"), eq(products.status, "published"))).limit(1);
    if (!markingProduct[0]) throw new Error("Instructor marking is not currently available");
    const markingAccess = await db.select().from(entitlements).where(and(eq(entitlements.userId, input.userId), eq(entitlements.productId, markingProduct[0].id), eq(entitlements.status, "active"))).limit(1);
    if (!hasActiveEntitlement(markingAccess[0])) throw new Error("Purchase the instructor marking add-on before sending this attempt for marking");
  }
  const status = input.optOutOfMarking ? "submitted" : "awaiting_marking";
  await db.update(attempts).set({ status, optOutOfMarking: input.optOutOfMarking ? 1 : 0, submittedAt: new Date() }).where(eq(attempts.id, input.attemptId));
  const created = await db.insert(submissions).values({ attemptId: input.attemptId, submittedBy: input.userId, status: input.optOutOfMarking ? "locked" : "received" }).$returningId();
  if (!input.optOutOfMarking) {
    await db.insert(markings).values({ attemptId: input.attemptId, status: "unassigned", totalPoints: 0, awardedPoints: 0 });
  }
  await db.insert(notifications).values({ userId: input.userId, type: "submission", subject: "Exam submission received", body: "Your submission has been securely locked and recorded." });
  return { submissionId: created[0]?.id, status };
}

export async function getUserFeedbackStates(userId: number) {
  const db = await getDb(); if (!db) return [];
  return db.select({ feedback: feedbackStates, attempt: attempts, mockExam: mockExams }).from(feedbackStates).innerJoin(attempts, eq(feedbackStates.attemptId, attempts.id)).innerJoin(mockExams, eq(attempts.mockExamId, mockExams.id)).where(and(eq(attempts.userId, userId), eq(feedbackStates.state, "available"))).orderBy(desc(feedbackStates.releasedAt));
}

export async function listAdminProducts() {
  const db = await getDb(); if (!db) return [];
  return db.select({ product: products, qualification: qualifications }).from(products).leftJoin(qualifications, eq(products.qualificationId, qualifications.id)).orderBy(desc(products.createdAt));
}

export async function getAdminContentOverview() {
  const db = await getDb();
  if (!db) return { products: 0, mockExams: 0, sections: 0, resources: 0, objectiveQuestions: 0 };
  const [productRows, mockRows, sectionRows, resourceRows, questionRows] = await Promise.all([
    db.select({ value: count() }).from(products),
    db.select({ value: count() }).from(mockExams),
    db.select({ value: count() }).from(caseStudySections),
    db.select({ value: count() }).from(resources),
    db.select({ value: count() }).from(objectiveQuestions),
  ]);
  return { products: Number(productRows[0]?.value ?? 0), mockExams: Number(mockRows[0]?.value ?? 0), sections: Number(sectionRows[0]?.value ?? 0), resources: Number(resourceRows[0]?.value ?? 0), objectiveQuestions: Number(questionRows[0]?.value ?? 0) };
}

export async function listAdminContent(kind: "mock_exams" | "sections" | "resources" | "objective_questions") {
  const db = await getDb(); if (!db) return [];
  if (kind === "mock_exams") {
    const rows = await db.select().from(mockExams).orderBy(desc(mockExams.createdAt));
    return rows.map((row) => ({ id: row.id, title: row.title, status: row.status, detail: `${row.examType.replace("_", " ")} · ${row.totalDurationSeconds / 60} minutes` }));
  }
  if (kind === "sections") {
    const rows = await db.select().from(caseStudySections).orderBy(asc(caseStudySections.sectionNumber));
    return rows.map((row) => ({ id: row.id, title: row.title, status: "published" as const, detail: `Section ${row.sectionNumber} · ${row.durationSeconds / 60} minutes` }));
  }
  if (kind === "resources") {
    const rows = await db.select().from(resources).orderBy(desc(resources.createdAt));
    return rows.map((row) => ({ id: row.id, title: row.title, status: row.status, detail: row.kind.replace("_", " ") }));
  }
  const rows = await db.select().from(objectiveQuestions).orderBy(desc(objectiveQuestions.createdAt));
  return rows.map((row) => ({ id: row.id, title: row.prompt.slice(0, 100), status: row.status === "retired" ? "archived" as const : row.status, detail: `${row.topic} · ${row.difficulty}` }));
}

export async function getAdminExamPreview(mockExamId: number) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const examRow = (await db.select({ mockExam: mockExams, product: products }).from(mockExams).innerJoin(products, eq(mockExams.productId, products.id)).where(eq(mockExams.id, mockExamId)).limit(1))[0];
  if (!examRow) throw new Error("Exam not found");
  const sections = await db.select({ id: caseStudySections.id, sectionNumber: caseStudySections.sectionNumber, title: caseStudySections.title, introduction: caseStudySections.introduction, scenario: caseStudySections.scenario, question: caseStudySections.question, durationSeconds: caseStudySections.durationSeconds }).from(caseStudySections).where(eq(caseStudySections.mockExamId, mockExamId)).orderBy(asc(caseStudySections.sectionNumber));
  const questions = await db.select({ id: objectiveQuestions.id, topic: objectiveQuestions.topic, learningOutcome: objectiveQuestions.learningOutcome, questionType: objectiveQuestions.questionType, prompt: objectiveQuestions.prompt, optionsJson: objectiveQuestions.optionsJson, answerJson: objectiveQuestions.answerJson, explanation: objectiveQuestions.explanation, rationaleJson: objectiveQuestions.rationaleJson, difficulty: objectiveQuestions.difficulty }).from(objectiveQuestions).where(eq(objectiveQuestions.mockExamId, mockExamId)).orderBy(objectiveQuestions.id);
  const emailResources = await db.select().from(resources).where(and(eq(resources.productId, examRow.mockExam.productId), eq(resources.kind, "email"))).orderBy(desc(resources.createdAt));
  const emailMeta = emailResources.map((resource) => { try { return JSON.parse(resource.fileUrl ?? "null") as { from?: string | null; to?: string | null; subject?: string | null; html?: string | null } | null; } catch { return null; } }).filter((entry): entry is { from?: string | null; to?: string | null; subject?: string | null; html?: string | null } => Boolean(entry))[0] ?? null;
  const feedbackResource = (await db.select().from(resources).where(and(eq(resources.productId, examRow.mockExam.productId), eq(resources.kind, "feedback"))).limit(1))[0];
  let feedbackText: string | null = null;
  if (feedbackResource?.fileUrl && feedbackResource.fileUrl.trim().startsWith("{")) {
    try { feedbackText = (JSON.parse(feedbackResource.fileUrl) as { text?: string }).text ?? null; } catch { feedbackText = null; }
  }
  return {
    mockExam: examRow.mockExam,
    product: examRow.product,
    sections,
    questions,
    email: emailMeta,
    feedbackText,
  };
}

export async function getAdminExamBundleDetail(mockExamId: number) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const examRow = (await db.select({ mockExam: mockExams, product: products }).from(mockExams).innerJoin(products, eq(mockExams.productId, products.id)).where(eq(mockExams.id, mockExamId)).limit(1))[0];
  if (!examRow) throw new Error("Exam not found");
  const sections = await db.select().from(caseStudySections).where(eq(caseStudySections.mockExamId, mockExamId)).orderBy(asc(caseStudySections.sectionNumber));
  const questions = await db.select().from(objectiveQuestions).where(eq(objectiveQuestions.mockExamId, mockExamId)).orderBy(objectiveQuestions.id);
  const allResources = await db.select().from(resources).where(eq(resources.productId, examRow.mockExam.productId)).orderBy(desc(resources.createdAt));
  const emailMeta = allResources
    .filter((resource) => resource.kind === "email" && resource.fileUrl && resource.fileUrl.trim().startsWith("{"))
    .map((resource) => { try { return JSON.parse(resource.fileUrl as string) as { from?: string | null; to?: string | null; subject?: string | null; html?: string | null } | null; } catch { return null; } })
    .filter((entry): entry is { from?: string | null; to?: string | null; subject?: string | null; html?: string | null } => Boolean(entry))[0] ?? null;
  const feedbackResource = allResources.find((resource) => resource.kind === "feedback");
  let feedbackText: string | null = null;
  if (feedbackResource?.fileUrl && feedbackResource.fileUrl.trim().startsWith("{")) {
    try { feedbackText = (JSON.parse(feedbackResource.fileUrl) as { text?: string }).text ?? null; } catch { feedbackText = null; }
  }
  return {
    mockExam: examRow.mockExam,
    product: examRow.product,
    sections: sections.map((section) => ({ id: section.id, sectionNumber: section.sectionNumber, title: section.title, introduction: section.introduction, scenario: section.scenario, question: section.question, durationSeconds: section.durationSeconds })),
    questions: questions.map((question) => ({
      id: question.id,
      topic: question.topic,
      learningOutcome: question.learningOutcome,
      questionType: question.questionType,
      prompt: question.prompt,
      optionsJson: question.optionsJson,
      answerJson: question.answerJson,
      explanation: question.explanation,
      rationaleJson: question.rationaleJson,
      difficulty: question.difficulty,
      attachmentUrl: question.attachmentUrl,
      attachmentFileName: question.attachmentFileName,
      attachmentMimeType: question.attachmentMimeType,
    })),
    email: emailMeta,
    feedbackText,
    resources: allResources.map((resource) => ({ id: resource.id, kind: resource.kind, title: resource.title, fileKey: resource.fileKey, fileUrl: resource.fileUrl })),
  };
}

export async function updateSectionTitle(input: { sectionId: number; title: string; userId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const title = input.title.trim();
  if (!title) throw new Error("Section title is required");
  await db.update(caseStudySections).set({ title }).where(eq(caseStudySections.id, input.sectionId));
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "case_study_section", entityId: input.sectionId, action: "rename", metadata: JSON.stringify({ title }) });
  return { success: true };
}

export async function updateAdminContentStatus(input: { kind: "mock_exams" | "resources" | "objective_questions"; id: number; status: "draft" | "published" | "archived"; userId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  if (input.kind === "mock_exams") {
    await db.update(mockExams).set({ status: input.status }).where(eq(mockExams.id, input.id));
    const exam = (await db.select({ productId: mockExams.productId }).from(mockExams).where(eq(mockExams.id, input.id)).limit(1))[0];
    if (exam) {
      await db.update(products).set({ status: input.status }).where(eq(products.id, exam.productId));
      await db.update(resources).set({ status: input.status }).where(eq(resources.productId, exam.productId));
      await db.update(objectiveQuestions).set({ status: input.status === "archived" ? "retired" : input.status }).where(eq(objectiveQuestions.mockExamId, input.id));
      await db.insert(auditEvents).values({ userId: input.userId, entityType: "product", entityId: exam.productId, action: `status_${input.status}`, metadata: JSON.stringify({ status: input.status, origin: "mock_exam_publish" }) });
    }
  }
  if (input.kind === "resources") await db.update(resources).set({ status: input.status }).where(eq(resources.id, input.id));
  if (input.kind === "objective_questions") await db.update(objectiveQuestions).set({ status: input.status === "archived" ? "retired" : input.status }).where(eq(objectiveQuestions.id, input.id));
  await db.insert(auditEvents).values({ userId: input.userId, entityType: input.kind, entityId: input.id, action: `status_${input.status}`, metadata: JSON.stringify({ status: input.status }) });
  return { success: true };
}

export async function updateProductStatus(input: { productId: number; status: "draft" | "published" | "archived"; userId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const product = (await db.select().from(products).where(eq(products.id, input.productId)).limit(1))[0];
  if (!product) throw new Error("Product not found");
  await db.update(products).set({ status: input.status }).where(eq(products.id, input.productId));

  const relatedMockExams = await db.select({ id: mockExams.id }).from(mockExams).where(eq(mockExams.productId, input.productId));
  const mockExamIds = relatedMockExams.map((row) => row.id);
  if (mockExamIds.length) {
    await db.update(mockExams).set({ status: input.status }).where(inArray(mockExams.id, mockExamIds));
    await db.update(resources).set({ status: input.status }).where(eq(resources.productId, input.productId));
    await db.update(objectiveQuestions).set({ status: input.status === "archived" ? "retired" : input.status }).where(inArray(objectiveQuestions.mockExamId, mockExamIds));
    for (const mockExamId of mockExamIds) {
      await db.insert(auditEvents).values({ userId: input.userId, entityType: "mock_exam", entityId: mockExamId, action: `status_${input.status}`, metadata: JSON.stringify({ status: input.status, origin: "product_publish" }) });
    }
  }
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "product", entityId: input.productId, action: `status_${input.status}`, metadata: JSON.stringify({ status: input.status }) });
  return { success: true };
}

export async function listMarkerQueue() {
  const db = await getDb(); if (!db) return [];
  return db.select({ marking: markings, submission: submissions, attempt: attempts }).from(markings).innerJoin(submissions, eq(markings.attemptId, submissions.attemptId)).innerJoin(attempts, eq(markings.attemptId, attempts.id)).where(inArray(markings.status, ["unassigned", "assigned", "in_progress"])).orderBy(desc(markings.createdAt));
}

export async function assignMarking(input: { markerId: number; markingId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  await db.update(markings).set({ markerId: input.markerId, status: "assigned" }).where(eq(markings.id, input.markingId));
  return { success: true };
}

export async function releaseFeedback(input: { markingId: number; feedback: string; awardedPoints: number; totalPoints: number; rubricSnapshot?: string }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const row = await db.select().from(markings).where(eq(markings.id, input.markingId)).limit(1);
  if (!row[0]) throw new Error("Marking not found");
  if (row[0].status === "submitted") throw new Error("Feedback has already been released");
  await db.update(markings).set({ status: "submitted", feedback: input.feedback, rubricSnapshot: input.rubricSnapshot ?? null, awardedPoints: input.awardedPoints, totalPoints: input.totalPoints, markedAt: new Date() }).where(eq(markings.id, input.markingId));
  await db.insert(feedbackStates).values({ attemptId: row[0].attemptId, state: "available", summary: input.feedback, releasedAt: new Date() });
  await db.update(attempts).set({ status: "marked" }).where(eq(attempts.id, row[0].attemptId));
  const attemptOwner = await db.select().from(attempts).where(eq(attempts.id, row[0].attemptId)).limit(1);
  if (attemptOwner[0]) await db.insert(notifications).values({ userId: attemptOwner[0].userId, type: "marking", subject: "Your marking is available", body: "Your case-study feedback has been released and is ready to review." });
  return { success: true };
}

export async function updateProductAccessDays(input: { productId: number; accessDays: number; userId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  if (!Number.isInteger(input.accessDays) || input.accessDays < 1 || input.accessDays > 3650) throw new Error("Access period must be between 1 and 3650 days");
  await db.update(products).set({ accessDays: input.accessDays }).where(eq(products.id, input.productId));
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "product", entityId: input.productId, action: "access_days_updated", metadata: JSON.stringify({ accessDays: input.accessDays }) });
  return { success: true, accessDays: input.accessDays };
}

export async function createAdminProduct(input: { userId: number; title: string; category: "case_study" | "objective_test" | "marking" | "resource"; description?: string; featuredImageUrl?: string; priceCents: number; accessDays?: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const title = input.title.trim(); if (!title) throw new Error("Product title is required");
  const created = await db.insert(products).values({ title, category: input.category, description: input.description?.trim() || null, featuredImageUrl: input.featuredImageUrl?.trim() || null, priceCents: Math.max(0, Math.round(input.priceCents)), accessDays: input.accessDays ?? 30, status: "draft" }).$returningId();
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "product", entityId: created[0]?.id ?? 0, action: "created", metadata: JSON.stringify({ title, category: input.category }) });
  return { id: created[0]?.id };
}

export async function createAdminMockExam(input: { userId: number; productId: number; title: string; examType: "case_study" | "objective_test"; intro?: string; totalDurationSeconds: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const title = input.title.trim(); if (!title) throw new Error("Exam title is required");
  const created = await db.insert(mockExams).values({ productId: input.productId, title, examType: input.examType, intro: input.intro?.trim() || null, totalDurationSeconds: Math.max(60, Math.round(input.totalDurationSeconds)), status: "draft" }).$returningId();
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "mock_exam", entityId: created[0]?.id ?? 0, action: "created", metadata: JSON.stringify({ title, examType: input.examType }) });
  return { id: created[0]?.id };
}

export async function createAdminObjectiveQuestion(input: { userId: number; mockExamId: number; topic: string; prompt: string; options: string[]; correct: number; questionType?: "single_choice" | "multiple_choice" | "dropdown" | "numerical" | "text_input"; explanation?: string; rationale?: string[]; difficulty: "easy" | "medium" | "hard"; attachmentBase64?: string; attachmentFileName?: string; attachmentMimeType?: string }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  if (!input.prompt.trim() || input.options.length < 2 || input.correct < 0 || input.correct >= input.options.length) throw new Error("Question, options, and a valid correct answer are required");
  let attachmentUrl: string | null = null;
  let attachmentFileName: string | null = null;
  let attachmentMimeType: string | null = null;
  if (input.attachmentBase64) {
    const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
    if (!input.attachmentMimeType || !allowed.has(input.attachmentMimeType)) throw new Error("Question attachment must be a PNG, JPEG, WebP, or GIF image");
    const payload = input.attachmentBase64.includes(",") ? input.attachmentBase64.split(",")[1] : input.attachmentBase64;
    const bytes = Buffer.from(payload, "base64");
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error("Question attachment must be between 1 byte and 10 MB");
    const uploaded = await storagePut(`objective-attachments/${input.mockExamId}/${Date.now()}-${(input.attachmentFileName || "question-image").replace(/[^a-zA-Z0-9._-]/g, "-")}`, bytes, input.attachmentMimeType);
    attachmentUrl = uploaded.url;
    attachmentFileName = input.attachmentFileName || "question-image";
    attachmentMimeType = input.attachmentMimeType;
  }
  const rationaleJson = input.rationale && input.rationale.length ? input.rationale.map((r) => r?.trim() || null) : null;
  const created = await db.insert(objectiveQuestions).values({ mockExamId: input.mockExamId, topic: input.topic.trim(), learningOutcome: null, questionType: input.questionType ?? "single_choice", prompt: input.prompt.trim(), optionsJson: JSON.stringify(input.options), answerJson: JSON.stringify(input.correct), attachmentUrl, attachmentFileName, attachmentMimeType, explanation: input.explanation?.trim() || null, rationaleJson: rationaleJson ? JSON.stringify(rationaleJson) : null, difficulty: input.difficulty, status: "draft" }).$returningId();
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "objective_question", entityId: created[0]?.id ?? 0, action: "created", metadata: JSON.stringify({ mockExamId: input.mockExamId, topic: input.topic, questionType: input.questionType ?? "single_choice", attachmentFileName }) });
  return { id: created[0]?.id, attachmentUrl };
}

export async function updateAdminObjectiveQuestionRationale(input: { userId: number; questionId: number; rationale: string[] }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const existing = (await db.select().from(objectiveQuestions).where(eq(objectiveQuestions.id, input.questionId)).limit(1))[0];
  if (!existing) throw new Error("Objective question not found");
  const rationaleJson = input.rationale.map((r) => r?.trim() || null);
  await db.update(objectiveQuestions).set({ rationaleJson: JSON.stringify(rationaleJson) }).where(eq(objectiveQuestions.id, input.questionId));
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "objective_question", entityId: input.questionId, action: "rationale_updated", metadata: JSON.stringify({ rationale: rationaleJson }) });
  return { success: true };
}

export async function uploadAdminResource(input: { userId: number; productId: number; title: string; kind: "pre_seen" | "formulae" | "printable_pdf" | "feedback" | "course_material" | "reference" | "email"; fileName: string; mimeType: string; base64: string }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const payload = input.base64.includes(",") ? input.base64.split(",")[1] : input.base64;
  const bytes = Buffer.from(payload, "base64");
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error("Resource file must be between 1 byte and 20 MB");
  const uploaded = await storagePut(`admin-resources/${input.productId}/${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}`, bytes, input.mimeType || "application/octet-stream");
  const created = await db.insert(resources).values({ productId: input.productId, title: input.title.trim() || input.fileName, kind: input.kind, fileKey: uploaded.key, fileUrl: uploaded.url, status: "draft" }).$returningId();
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "resource", entityId: created[0]?.id ?? 0, action: "uploaded", metadata: JSON.stringify({ productId: input.productId, fileName: input.fileName, kind: input.kind }) });
  return { id: created[0]?.id, key: uploaded.key };
}

export async function updateProductPrice(input: { productId: number; priceCents: number; userId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  if (!Number.isInteger(input.priceCents) || input.priceCents < 0) throw new Error("Price cannot be negative");
  await db.update(products).set({ priceCents: input.priceCents }).where(eq(products.id, input.productId));
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "product", entityId: input.productId, action: "price_updated", metadata: JSON.stringify({ priceCents: input.priceCents }) });
  return { success: true, priceCents: input.priceCents };
}

export async function updateAdminProduct(input: { userId: number; productId: number; title: string; category: "case_study" | "objective_test" | "marking" | "resource"; description?: string; featuredImageUrl?: string; priceCents: number; accessDays: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const existing = (await db.select().from(products).where(eq(products.id, input.productId)).limit(1))[0];
  if (!existing) throw new Error("Product not found");
  const title = input.title.trim();
  if (!title) throw new Error("Product title is required");
  if (!Number.isInteger(input.priceCents) || input.priceCents < 0) throw new Error("Price cannot be negative");
  if (!Number.isInteger(input.accessDays) || input.accessDays < 1 || input.accessDays > 3650) throw new Error("Access period must be between 1 and 3650 days");
  const description = input.description?.trim() ?? existing.description;
  const featuredImageUrl = input.featuredImageUrl?.trim() ?? existing.featuredImageUrl;
  await db.update(products).set({
    title,
    category: input.category,
    description,
    featuredImageUrl,
    priceCents: Math.round(input.priceCents),
    accessDays: input.accessDays,
  }).where(eq(products.id, input.productId));
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "product", entityId: input.productId, action: "updated", metadata: JSON.stringify({ title, category: input.category, description, featuredImageUrl, priceCents: input.priceCents, accessDays: input.accessDays }) });
  return { success: true };
}

export async function uploadProductImage(input: { userId: number; productId: number; fileName: string; mimeType: string; base64: string }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const existing = (await db.select().from(products).where(eq(products.id, input.productId)).limit(1))[0];
  if (!existing) throw new Error("Product not found");
  const allowed = new Set(["image/png", "image/jpeg"]);
  if (!input.mimeType || !allowed.has(input.mimeType)) throw new Error("Product image must be a PNG or JPEG");
  const payload = input.base64.includes(",") ? input.base64.split(",")[1] : input.base64;
  const bytes = Buffer.from(payload, "base64");
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error("Product image must be between 1 byte and 10 MB");
  const ext = input.mimeType === "image/png" ? "png" : "jpg";
  const uploaded = await storagePut(`product-images/${input.productId}/${Date.now()}-${(input.fileName || "product-image").replace(/[^a-zA-Z0-9._-]/g, "-")}.${ext}`, bytes, input.mimeType);
  await db.update(products).set({ featuredImageUrl: uploaded.url }).where(eq(products.id, input.productId));
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "product", entityId: input.productId, action: "image_uploaded", metadata: JSON.stringify({ key: uploaded.key, mimeType: input.mimeType }) });
  return { key: uploaded.key, url: uploaded.url };
}

export type ExamBundleFile = { fileName: string; mimeType: string; base64: string };
export type ExamBundleObjectiveQuestion = {
  topic: string;
  prompt: string;
  questionType?: "single_choice" | "multiple_choice" | "dropdown" | "numerical" | "text_input";
  options: string[];
  correct: number;
  explanation?: string;
  rationale?: string[];
  attachment?: ExamBundleFile;
};
export type ExamBundleCaseStudySection = {
  sectionNumber: number;
  title: string;
  introduction?: string;
  scenario?: string;
  question?: string;
  durationSeconds: number;
  cooldownSeconds?: number;
};
export type ExamBundleInput = {
  userId: number;
  title: string;
  examType: "case_study" | "objective_test";
  intro?: string;
  description?: string;
  priceCents: number;
  accessDays: number;
  totalDurationSeconds: number;
  featuredImage?: ExamBundleFile;
  featuredImageUrl?: string;
  // pre-moderated exam PDF / document (uploaded, formatted) - used as extra resource if provided
  preModeratedPdf?: ExamBundleFile;
  // attachments by resource kind
  preSeen?: ExamBundleFile;
  formulae?: ExamBundleFile;
  reference?: ExamBundleFile;
  // case-study email: composed fields (from / to / subject) and rich-text HTML body, plus optional image
  emailFrom?: string;
  emailTo?: string;
  emailSubject?: string;
  emailText?: string;
  emailImage?: ExamBundleFile;
  // case-study exam sections (tasks) with per-section timing
  caseStudySections?: ExamBundleCaseStudySection[];
  // exam feedback: either typed text or a file (e.g. suggested solutions / marking guide)
  feedbackText?: string;
  feedbackFile?: ExamBundleFile;
  // objective-test questions built inline in the studio (topics, questions, answers, feedback)
  objectiveQuestions?: ExamBundleObjectiveQuestion[];
};

/**
 * Creates a product, its linked mock exam, and any attached resources in a single
 * orchestrating operation. This is the backend for the instructor "create exam"
 * studio. New records are created as drafts so an administrator publishes them.
 * For a case-study exam created manually (no pre-moderated PDF supplied) a branded
 * AFT printable PDF is generated automatically from the exam record.
 */
export async function createExamBundle(input: ExamBundleInput) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const title = input.title.trim();
  if (!title) throw new Error("Exam title is required");
  if (!input.examType) throw new Error("Exam type is required");

  // 1. Create the store product (draft)
  const productId = (await db.insert(products).values({
    title,
    category: input.examType,
    description: input.description?.trim() || null,
    featuredImageUrl: input.featuredImageUrl?.trim() || null,
    priceCents: Math.max(0, Math.round(input.priceCents)),
    accessDays: input.accessDays && input.accessDays > 0 ? input.accessDays : 30,
    status: "draft",
  }).$returningId())[0]?.id;
  if (!productId) throw new Error("Failed to create the store product");
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "product", entityId: productId, action: "created", metadata: JSON.stringify({ title, category: input.examType }) });

  // 2. Upload featured image if provided
  if (input.featuredImage) {
    const allowed = new Set(["image/png", "image/jpeg"]);
    if (!input.featuredImage.mimeType || !allowed.has(input.featuredImage.mimeType)) throw new Error("Featured image must be a PNG or JPEG");
    const payload = input.featuredImage.base64.includes(",") ? input.featuredImage.base64.split(",")[1] : input.featuredImage.base64;
    const bytes = Buffer.from(payload, "base64");
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error("Featured image must be between 1 byte and 10 MB");
    const ext = input.featuredImage.mimeType === "image/png" ? "png" : "jpg";
    const uploaded = await storagePut(`product-images/${productId}/${Date.now()}-${(input.featuredImage.fileName || "product-image").replace(/[^a-zA-Z0-9._-]/g, "-")}.${ext}`, bytes, input.featuredImage.mimeType);
    await db.update(products).set({ featuredImageUrl: uploaded.url }).where(eq(products.id, productId));
    await db.insert(auditEvents).values({ userId: input.userId, entityType: "product", entityId: productId, action: "image_uploaded", metadata: JSON.stringify({ key: uploaded.key, mimeType: input.featuredImage.mimeType }) });
  }

  // 3. Create the mock exam (draft)
  const mockExamId = (await db.insert(mockExams).values({
    productId,
    title,
    examType: input.examType,
    intro: input.intro?.trim() || null,
    totalDurationSeconds: Math.max(60, Math.round(input.totalDurationSeconds)),
    status: "draft",
  }).$returningId())[0]?.id;
  if (!mockExamId) throw new Error("Failed to create the exam record");
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "mock_exam", entityId: mockExamId, action: "created", metadata: JSON.stringify({ title, examType: input.examType }) });

  // 3b. Create objective-test questions if any were authored inline in the studio
  const createdQuestionIds: number[] = [];
  if (input.objectiveQuestions && input.objectiveQuestions.length) {
    for (const question of input.objectiveQuestions) {
      if (!question.prompt?.trim()) continue;
      const qtype = question.questionType ?? "single_choice";
      const options = (question.options ?? []).map((option) => option?.trim()).filter(Boolean);
      const needsOptions = qtype !== "numerical" && qtype !== "text_input";
      if (needsOptions && options.length < 2) continue;
      const correct = Math.min(Math.max(Math.round(question.correct) || 0, 0), Math.max(options.length - 1, 0));
      let attachmentUrl: string | null = null;
      let attachmentFileName: string | null = null;
      let attachmentMimeType: string | null = null;
      if (question.attachment?.base64) {
        const file = question.attachment;
        const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
        if (file.mimeType && allowed.has(file.mimeType)) {
          const raw = file.base64.includes(",") ? file.base64.split(",")[1] : file.base64;
          const bytes = Buffer.from(raw, "base64");
          if (bytes.length && bytes.length <= 10 * 1024 * 1024) {
            try {
              const uploaded = await storagePut(`objective-attachments/${mockExamId}/${Date.now()}-${(file.fileName || "question-image").replace(/[^a-zA-Z0-9._-]/g, "-")}`, bytes, file.mimeType);
              attachmentUrl = uploaded.url;
              attachmentFileName = file.fileName || "question-image";
              attachmentMimeType = file.mimeType;
            } catch (error) {
              console.warn("[createExamBundle] question attachment upload failed", error);
            }
          }
        }
      }
      const rationaleJson = question.rationale && question.rationale.length ? question.rationale.map((r) => r?.trim() || null) : null;
      const row = (await db.insert(objectiveQuestions).values({
        mockExamId,
        topic: question.topic?.trim() || "General",
        learningOutcome: null,
        questionType: qtype,
        prompt: question.prompt.trim(),
        optionsJson: JSON.stringify(options),
        answerJson: JSON.stringify(correct),
        attachmentUrl,
        attachmentFileName,
        attachmentMimeType,
        explanation: question.explanation?.trim() || null,
        rationaleJson: rationaleJson ? JSON.stringify(rationaleJson) : null,
        difficulty: "medium",
        status: "draft",
      }).$returningId())[0]?.id;
      if (row) createdQuestionIds.push(row);
    }
    if (createdQuestionIds.length) {
      await db.insert(auditEvents).values({ userId: input.userId, entityType: "objective_question", entityId: mockExamId, action: "bundle_created", metadata: JSON.stringify({ mockExamId, count: createdQuestionIds.length, ids: createdQuestionIds }) });
    }
  }

  // 3c. Create case-study sections (tasks with per-section timing) if authored inline in the studio
  const sectionNumbers: number[] = [];
  if (input.caseStudySections && input.caseStudySections.length) {
    for (const section of input.caseStudySections) {
      const secNumber = Math.max(1, Math.round(section.sectionNumber) || 0);
      const secTitle = section.title?.trim();
      if (!secTitle) continue;
      const existing = await db.select({ id: caseStudySections.id }).from(caseStudySections).where(and(eq(caseStudySections.mockExamId, mockExamId), eq(caseStudySections.sectionNumber, secNumber))).limit(1);
      if (existing.length) continue;
      const created = (await db.insert(caseStudySections).values({
        mockExamId,
        sectionNumber: secNumber,
        title: secTitle.slice(0, 240),
        introduction: section.introduction?.trim() || null,
        scenario: section.scenario?.trim() || null,
        question: section.question?.trim() || null,
        durationSeconds: Math.max(60, Math.round(section.durationSeconds) || 2700),
        cooldownSeconds: Math.max(0, Math.round(section.cooldownSeconds ?? 30)),
      }).$returningId())[0]?.id;
      if (created) sectionNumbers.push(secNumber);
    }
    if (sectionNumbers.length) {
      await db.insert(auditEvents).values({ userId: input.userId, entityType: "case_study_section", entityId: mockExamId, action: "bundle_created", metadata: JSON.stringify({ mockExamId, sectionNumbers }) });
    }
  }

  const uploadResource = async (kind: "pre_seen" | "formulae" | "reference" | "email" | "printable_pdf" | "feedback", file: ExamBundleFile, resTitle: string) => {
    if (!file || !file.base64) return;
    const payload = file.base64.includes(",") ? file.base64.split(",")[1] : file.base64;
    const bytes = Buffer.from(payload, "base64");
    if (!bytes.length) return;
    const uploaded = await storagePut(`admin-resources/${productId}/${Date.now()}-${(file.fileName || resTitle).replace(/[^a-zA-Z0-9._-]/g, "-")}`, bytes, file.mimeType || "application/octet-stream");
    const resourceId = (await db.insert(resources).values({ productId, title: resTitle, kind, fileKey: uploaded.key, fileUrl: uploaded.url, status: "draft" }).$returningId())[0]?.id;
    await db.insert(auditEvents).values({ userId: input.userId, entityType: "resource", entityId: resourceId ?? 0, action: "uploaded", metadata: JSON.stringify({ productId, fileName: file.fileName, kind }) });
  };

  // 4. Attach resources
  if (input.preSeen) await uploadResource("pre_seen", input.preSeen, `${title} · Pre-seen`);
  if (input.formulae) await uploadResource("formulae", input.formulae, `${title} · Formulae + tables`);
  if (input.reference) await uploadResource("reference", input.reference, `${title} · Reference material`);

  // 5. Pre-moderated PDF - treated as the protected printable question paper
  if (input.preModeratedPdf) {
    await uploadResource("printable_pdf", input.preModeratedPdf, `${title} · Printable exam`);
  }

  // 6. Email attachment - either composed email fields (stored as JSON in fileUrl) or an image upload
  const hasEmailText = input.emailText && input.emailText.trim();
  const hasEmailImage = input.emailImage && input.emailImage.base64;
  if (hasEmailText || hasEmailImage) {
    const emailMeta = JSON.stringify({
      from: input.emailFrom?.trim() || null,
      to: input.emailTo?.trim() || null,
      subject: input.emailSubject?.trim() || null,
      html: input.emailText?.trim() || null,
    });
    await db.insert(resources).values({ productId, title: `${title} · Email`, kind: "email", fileKey: null, fileUrl: emailMeta, status: "draft" });
    if (hasEmailText) {
      await db.insert(auditEvents).values({ userId: input.userId, entityType: "resource", entityId: 0, action: "email_composed", metadata: JSON.stringify({ productId, from: input.emailFrom, to: input.emailTo, subject: input.emailSubject }) });
    }
  }
  if (input.emailImage && input.emailImage.base64) {
    await uploadResource("email", input.emailImage, `${title} · Email`);
  }

  // 6b. Exam feedback - either typed text or a document (e.g. suggested solutions / marking guide)
  if (input.feedbackText && input.feedbackText.trim()) {
    await db.insert(resources).values({ productId, title: `${title} · Feedback`, kind: "feedback", fileKey: null, fileUrl: JSON.stringify({ text: input.feedbackText.trim() }), status: "draft" });
  } else if (input.feedbackFile && input.feedbackFile.base64) {
    await uploadResource("feedback", input.feedbackFile, `${title} · Feedback`);
  }

  // 7. Auto-generate the branded AFT PDF for a manually created case-study exam
  //    (no pre-moderated PDF provided). Uses the existing AFT-logo generation.
  let generatedPdfUrl: string | null = null;
  if (input.examType === "case_study" && !input.preModeratedPdf) {
    const sections = await db.select({ sectionNumber: caseStudySections.sectionNumber, title: caseStudySections.title, durationSeconds: caseStudySections.durationSeconds, introduction: caseStudySections.introduction }).from(caseStudySections).where(eq(caseStudySections.mockExamId, mockExamId)).orderBy(asc(caseStudySections.sectionNumber));
    const exam = { title, intro: input.intro?.trim() || null, totalDurationSeconds: Math.max(60, Math.round(input.totalDurationSeconds)) };
    try {
      const bytes = await generateBrandedPrintablePdf(exam, sections.length ? sections : [{ sectionNumber: 1, title: "Case study task", durationSeconds: Math.max(60, Math.round(input.totalDurationSeconds)), introduction: "Refer to the protected question paper for the complete case-study task and instructions." }]);
      const uploaded = await storagePut(`mock-exams/${mockExamId}/printable-exam.pdf`, bytes, "application/pdf");
      const resourceId = (await db.insert(resources).values({ productId, title: `${title} · Printable exam`, kind: "printable_pdf", fileKey: uploaded.key, fileUrl: uploaded.url, status: "draft" }).$returningId())[0]?.id;
      generatedPdfUrl = uploaded.url;
      await db.insert(auditEvents).values({ userId: input.userId, entityType: "mock_exam", entityId: mockExamId, action: "printable_pdf_generated", metadata: JSON.stringify({ mockExamId, resourceId }) });
    } catch (error) {
      console.warn("[createExamBundle] PDF generation failed", error);
    }
  }

  return { productId, mockExamId, generatedPdfUrl, questionCount: createdQuestionIds.length };
}

export type ExamBundleExistingFile = { fileName: string; keepUrl: string };
export type ExamBundleFileInput = { fileName: string; mimeType?: string; base64?: string; keepUrl?: string } | null;

export type ExamBundleUpdateInput = {
  userId: number;
  mockExamId: number;
  title: string;
  examType: "case_study" | "objective_test";
  intro?: string;
  description?: string;
  priceCents: number;
  accessDays: number;
  totalDurationSeconds: number;
  featuredImage?: ExamBundleFile | null;
  featuredImageUrl?: string | null;
  preModeratedPdf?: ExamBundleFileInput;
  preSeen?: ExamBundleFileInput;
  formulae?: ExamBundleFileInput;
  reference?: ExamBundleFileInput;
  emailFrom?: string | null;
  emailTo?: string | null;
  emailSubject?: string | null;
  emailText?: string | null;
  emailImage?: ExamBundleFileInput;
  caseStudySections?: ExamBundleCaseStudySection[];
  feedbackText?: string | null;
  feedbackFile?: ExamBundleFileInput;
  objectiveQuestions?: (Omit<ExamBundleObjectiveQuestion, "attachment"> & { attachment?: ExamBundleFileInput })[];
};

function existingUrlName(url?: string | null): string | undefined {
  if (!url) return undefined;
  try {
    const clean = url.split("?")[0];
    const segment = clean.split("/").filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Comprehensive save for an existing exam bundle. Mirrors createExamBundle so the
 * exam studio can be used to edit drafts and published exams. Keeps the current
 * status of the mock exam and its store product untouched.
 *
 * - Removed/omitted questions and case-study sections are replaced wholesale.
 * - Resources (pre-seen, formulae, reference, printable PDF, email image,
 *   feedback file) are uploaded when a new base64 file is supplied, kept when a
 *   `keepUrl` payload is supplied, removed when an explicit `null` is supplied,
 *   and left untouched when the field is undefined.
 */
export async function updateExamBundle(input: ExamBundleUpdateInput) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const existing = (await db.select({ mockExam: mockExams, product: products }).from(mockExams).innerJoin(products, eq(mockExams.productId, products.id)).where(eq(mockExams.id, input.mockExamId)).limit(1))[0];
  if (!existing) throw new Error("Exam not found");
  const title = input.title.trim();
  if (!title) throw new Error("Exam title is required");
  const productId = existing.mockExam.productId;

  // 1. Update the store product (status untouched)
  let featuredImageUrl = existing.product.featuredImageUrl;
  if (input.featuredImage) {
    const allowed = new Set(["image/png", "image/jpeg"]);
    if (!input.featuredImage.mimeType || !allowed.has(input.featuredImage.mimeType)) throw new Error("Featured image must be a PNG or JPEG");
    const payload = input.featuredImage.base64.includes(",") ? input.featuredImage.base64.split(",")[1] : input.featuredImage.base64;
    const bytes = Buffer.from(payload, "base64");
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error("Featured image must be between 1 byte and 10 MB");
    const ext = input.featuredImage.mimeType === "image/png" ? "png" : "jpg";
    const uploaded = await storagePut(`product-images/${productId}/${Date.now()}-${(input.featuredImage.fileName || "product-image").replace(/[^a-zA-Z0-9._-]/g, "-")}.${ext}`, bytes, input.featuredImage.mimeType);
    featuredImageUrl = uploaded.url;
    await db.insert(auditEvents).values({ userId: input.userId, entityType: "product", entityId: productId, action: "image_uploaded", metadata: JSON.stringify({ key: uploaded.key, mimeType: input.featuredImage.mimeType }) });
  } else if (typeof input.featuredImageUrl === "string") {
    featuredImageUrl = input.featuredImageUrl.trim() || null;
  } else if (input.featuredImageUrl === null) {
    featuredImageUrl = null;
  }
  await db.update(products).set({
    title,
    category: input.examType,
    description: input.description?.trim() || null,
    featuredImageUrl,
    priceCents: Math.max(0, Math.round(input.priceCents)),
    accessDays: input.accessDays && input.accessDays > 0 ? input.accessDays : existing.product.accessDays,
  }).where(eq(products.id, productId));
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "product", entityId: productId, action: "updated", metadata: JSON.stringify({ title, category: input.examType }) });

  // 2. Update the mock exam (status untouched)
  await db.update(mockExams).set({
    title,
    examType: input.examType,
    intro: input.intro?.trim() || null,
    totalDurationSeconds: Math.max(60, Math.round(input.totalDurationSeconds)),
  }).where(eq(mockExams.id, input.mockExamId));
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "mock_exam", entityId: input.mockExamId, action: "updated", metadata: JSON.stringify({ title, examType: input.examType }) });

  // 3. Replace objective-test questions wholesale
  const createdQuestionIds: number[] = [];
  if (input.objectiveQuestions) {
    await db.delete(objectiveQuestions).where(eq(objectiveQuestions.mockExamId, input.mockExamId));
    for (const question of input.objectiveQuestions) {
      if (!question.prompt?.trim()) continue;
      const qtype = question.questionType ?? "single_choice";
      const options = (question.options ?? []).map((option) => option?.trim()).filter(Boolean);
      const needsOptions = qtype !== "numerical" && qtype !== "text_input";
      if (needsOptions && options.length < 2) continue;
      let answerValue: number | number[] = Math.min(Math.max(Math.round(question.correct) || 0, 0), Math.max(options.length - 1, 0));
      if (qtype === "multiple_choice") {
        const raw = String(question.correct).split(/[,;\s]+/).map((part) => parseInt(part, 10)).filter((n) => Number.isFinite(n) && n >= 0 && n < options.length);
        answerValue = raw.length ? raw : [answerValue];
      }
      let attachmentUrl: string | null = null;
      let attachmentFileName: string | null = null;
      let attachmentMimeType: string | null = null;
      const attachment = question.attachment;
      if (attachment && "keepUrl" in attachment && attachment.keepUrl) {
        attachmentUrl = attachment.keepUrl;
        attachmentFileName = attachment.fileName || existingUrlName(attachment.keepUrl) || "attachment";
      } else if (attachment && "base64" in attachment && attachment.base64) {
        const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
        if (attachment.mimeType && allowed.has(attachment.mimeType)) {
          const raw = attachment.base64.includes(",") ? attachment.base64.split(",")[1] : attachment.base64;
          const bytes = Buffer.from(raw, "base64");
          if (bytes.length && bytes.length <= 10 * 1024 * 1024) {
            try {
              const uploaded = await storagePut(`objective-attachments/${input.mockExamId}/${Date.now()}-${(attachment.fileName || "question-image").replace(/[^a-zA-Z0-9._-]/g, "-")}`, bytes, attachment.mimeType);
              attachmentUrl = uploaded.url;
              attachmentFileName = attachment.fileName || "question-image";
              attachmentMimeType = attachment.mimeType;
            } catch (error) {
              console.warn("[updateExamBundle] question attachment upload failed", error);
            }
          }
        }
      }
      const rationaleJson = question.rationale && question.rationale.length ? question.rationale.map((r) => r?.trim() || null) : null;
      const row = (await db.insert(objectiveQuestions).values({
        mockExamId: input.mockExamId,
        topic: question.topic?.trim() || "General",
        learningOutcome: null,
        questionType: qtype,
        prompt: question.prompt.trim(),
        optionsJson: JSON.stringify(options),
        answerJson: JSON.stringify(answerValue),
        attachmentUrl,
        attachmentFileName,
        attachmentMimeType,
        explanation: question.explanation?.trim() || null,
        rationaleJson: rationaleJson ? JSON.stringify(rationaleJson) : null,
        difficulty: "medium",
        status: existing.mockExam.status === "published" ? "published" : "draft",
      }).$returningId())[0]?.id;
      if (row) createdQuestionIds.push(row);
    }
    if (createdQuestionIds.length) {
      await db.insert(auditEvents).values({ userId: input.userId, entityType: "objective_question", entityId: input.mockExamId, action: "bundle_updated", metadata: JSON.stringify({ mockExamId: input.mockExamId, count: createdQuestionIds.length, ids: createdQuestionIds }) });
    }
  }

  // 4. Replace case-study sections wholesale
  if (input.caseStudySections) {
    await db.delete(caseStudySections).where(eq(caseStudySections.mockExamId, input.mockExamId));
    const sectionNumbers: number[] = [];
    for (const section of input.caseStudySections) {
      const secNumber = Math.max(1, Math.round(section.sectionNumber) || 0);
      const secTitle = section.title?.trim();
      if (!secTitle) continue;
      const created = (await db.insert(caseStudySections).values({
        mockExamId: input.mockExamId,
        sectionNumber: secNumber,
        title: secTitle.slice(0, 240),
        introduction: section.introduction?.trim() || null,
        scenario: section.scenario?.trim() || null,
        question: section.question?.trim() || null,
        durationSeconds: Math.max(60, Math.round(section.durationSeconds) || 2700),
        cooldownSeconds: Math.max(0, Math.round(section.cooldownSeconds ?? 30)),
      }).$returningId())[0]?.id;
      if (created) sectionNumbers.push(secNumber);
    }
    if (sectionNumbers.length) {
      await db.insert(auditEvents).values({ userId: input.userId, entityType: "case_study_section", entityId: input.mockExamId, action: "bundle_updated", metadata: JSON.stringify({ mockExamId: input.mockExamId, sectionNumbers }) });
    }
  }

  const uploadResource = async (kind: "pre_seen" | "formulae" | "reference" | "email" | "printable_pdf" | "feedback", file: { fileName: string; mimeType?: string; base64: string }, resTitle: string) => {
    const payload = file.base64.includes(",") ? file.base64.split(",")[1] : file.base64;
    const bytes = Buffer.from(payload, "base64");
    if (!bytes.length) return;
    const uploaded = await storagePut(`admin-resources/${productId}/${Date.now()}-${(file.fileName || resTitle).replace(/[^a-zA-Z0-9._-]/g, "-")}`, bytes, file.mimeType || "application/octet-stream");
    const resourceId = (await db.insert(resources).values({ productId, title: resTitle, kind, fileKey: uploaded.key, fileUrl: uploaded.url, status: existing.mockExam.status === "published" ? "published" : "draft" }).$returningId())[0]?.id;
    await db.insert(auditEvents).values({ userId: input.userId, entityType: "resource", entityId: resourceId ?? 0, action: "uploaded", metadata: JSON.stringify({ productId, fileName: file.fileName, kind }) });
    return uploaded.url;
  };

  const replaceResource = async (kind: "pre_seen" | "formulae" | "reference" | "printable_pdf", file: ExamBundleFileInput, resTitle: string) => {
    if (file === null) {
      await db.delete(resources).where(and(eq(resources.productId, productId), eq(resources.kind, kind)));
      await db.insert(auditEvents).values({ userId: input.userId, entityType: "resource", entityId: 0, action: "removed", metadata: JSON.stringify({ productId, kind }) });
      return;
    }
    if (!file || "keepUrl" in file || !file.base64) return;
    const url = await uploadResource(kind, { fileName: file.fileName, mimeType: file.mimeType, base64: file.base64 }, resTitle);
    if (url) {
      await db.delete(resources).where(and(eq(resources.productId, productId), eq(resources.kind, kind)));
    }
  };

  // 5. Resource attachments
  if (input.preSeen !== undefined) await replaceResource("pre_seen", input.preSeen, `${title} · Pre-seen`);
  if (input.formulae !== undefined) await replaceResource("formulae", input.formulae, `${title} · Formulae + tables`);
  if (input.reference !== undefined) await replaceResource("reference", input.reference, `${title} · Reference material`);
  if (input.preModeratedPdf !== undefined) await replaceResource("printable_pdf", input.preModeratedPdf, `${title} · Printable exam`);

  // 6. Email attachment (composed JSON meta + optional image)
  if (input.emailFrom !== undefined || input.emailTo !== undefined || input.emailSubject !== undefined || input.emailText !== undefined || input.emailImage !== undefined) {
    const emailMeta = JSON.stringify({
      from: input.emailFrom?.trim() || null,
      to: input.emailTo?.trim() || null,
      subject: input.emailSubject?.trim() || null,
      html: input.emailText?.trim() || null,
    });
    await db.delete(resources).where(and(eq(resources.productId, productId), eq(resources.kind, "email")));
    if (input.emailText?.trim() || input.emailFrom?.trim() || input.emailTo?.trim() || input.emailSubject?.trim()) {
      await db.insert(resources).values({ productId, title: `${title} · Email`, kind: "email", fileKey: null, fileUrl: emailMeta, status: existing.mockExam.status === "published" ? "published" : "draft" });
    }
    const emailImage = input.emailImage;
    if (emailImage && "keepUrl" in emailImage && emailImage.keepUrl) {
      await db.insert(resources).values({ productId, title: `${title} · Email`, kind: "email", fileKey: null, fileUrl: emailImage.keepUrl, status: existing.mockExam.status === "published" ? "published" : "draft" });
    } else if (emailImage && "base64" in emailImage && emailImage.base64) {
      await uploadResource("email", { fileName: emailImage.fileName, mimeType: emailImage.mimeType, base64: emailImage.base64 }, `${title} · Email`);
    }
    await db.insert(auditEvents).values({ userId: input.userId, entityType: "resource", entityId: 0, action: "email_composed", metadata: JSON.stringify({ productId, subject: input.emailSubject }) });
  }

  // 7. Feedback: typed text or attached document
  if (input.feedbackText !== undefined || input.feedbackFile !== undefined) {
    if (input.feedbackText?.trim()) {
      await db.delete(resources).where(and(eq(resources.productId, productId), eq(resources.kind, "feedback")));
      await db.insert(resources).values({ productId, title: `${title} · Feedback`, kind: "feedback", fileKey: null, fileUrl: JSON.stringify({ text: input.feedbackText.trim() }), status: existing.mockExam.status === "published" ? "published" : "draft" });
    } else if (input.feedbackFile) {
      await db.delete(resources).where(and(eq(resources.productId, productId), eq(resources.kind, "feedback")));
      if ("keepUrl" in input.feedbackFile && input.feedbackFile.keepUrl) {
        await db.insert(resources).values({ productId, title: `${title} · Feedback`, kind: "feedback", fileKey: null, fileUrl: input.feedbackFile.keepUrl, status: existing.mockExam.status === "published" ? "published" : "draft" });
      } else if ("base64" in input.feedbackFile && input.feedbackFile.base64) {
        await uploadResource("feedback", { fileName: input.feedbackFile.fileName, mimeType: input.feedbackFile.mimeType, base64: input.feedbackFile.base64 }, `${title} · Feedback`);
      }
    } else if (input.feedbackFile === null) {
      await db.delete(resources).where(and(eq(resources.productId, productId), eq(resources.kind, "feedback")));
    }
  }

  return { success: true, mockExamId: input.mockExamId, questionCount: createdQuestionIds.length };
}

export async function deleteExamBundle(input: { userId: number; mockExamId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const exam = (await db.select({ id: mockExams.id, productId: mockExams.productId, title: mockExams.title, status: mockExams.status }).from(mockExams).where(eq(mockExams.id, input.mockExamId)).limit(1))[0];
  if (!exam) throw new Error("Exam not found");
  const attemptIds = (await db.select({ id: attempts.id }).from(attempts).where(eq(attempts.mockExamId, input.mockExamId))).map((row) => row.id);
  if (attemptIds.length) {
    await db.delete(answers).where(inArray(answers.attemptId, attemptIds));
    await db.delete(feedbackStates).where(inArray(feedbackStates.attemptId, attemptIds));
    await db.delete(markings).where(inArray(markings.attemptId, attemptIds));
    await db.delete(submissions).where(inArray(submissions.attemptId, attemptIds));
    await db.delete(attempts).where(inArray(attempts.id, attemptIds));
  }
  await db.delete(caseStudySections).where(eq(caseStudySections.mockExamId, input.mockExamId));
  await db.delete(objectiveQuestions).where(eq(objectiveQuestions.mockExamId, input.mockExamId));
  await db.delete(mockExams).where(eq(mockExams.id, input.mockExamId));
  await db.delete(resources).where(eq(resources.productId, exam.productId));
  await db.delete(entitlements).where(eq(entitlements.productId, exam.productId));
  await db.delete(payments).where(eq(payments.productId, exam.productId));
  await db.delete(products).where(eq(products.id, exam.productId));
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "mock_exam", entityId: input.mockExamId, action: "deleted", metadata: JSON.stringify({ title: exam.title, status: exam.status }) });
  return { success: true, title: exam.title };
}

export async function listAdminCatalogue() {
  const db = await getDb(); if (!db) return { products: [], mockExams: [] };
  const [productsRows, rowset] = await Promise.all([
    db.select({ product: products, qualification: qualifications }).from(products).leftJoin(qualifications, eq(products.qualificationId, qualifications.id)).orderBy(desc(products.createdAt)),
    db.select({ mockExam: mockExams, product: products, qualification: qualifications }).from(mockExams).innerJoin(products, eq(mockExams.productId, products.id)).leftJoin(qualifications, eq(products.qualificationId, qualifications.id)).orderBy(desc(mockExams.createdAt)),
  ]);
  return { products: productsRows, mockExams: rowset };
}

export async function claimFreeProduct(input: { userId: number; productId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const product = (await db.select().from(products).where(eq(products.id, input.productId)).limit(1))[0];
  if (!product || product.status !== "published") throw new Error("Product unavailable");
  if (product.priceCents > 0) throw new Error("This product requires checkout");
  const existing = (await db.select().from(entitlements).where(and(eq(entitlements.userId, input.userId), eq(entitlements.productId, input.productId), eq(entitlements.status, "active"))).limit(1))[0];
  if (existing && hasActiveEntitlement(existing)) return { success: true, alreadyOwned: true };
  const startsAt = new Date();
  const created = await db.insert(entitlements).values({ userId: input.userId, productId: input.productId, source: "free", status: "active", startsAt, expiresAt: entitlementExpiryFromAccessDays(product.accessDays, startsAt) }).$returningId();
  await db.insert(notifications).values({ userId: input.userId, type: "purchase", subject: "Free objective test added", body: `Your access to ${product.title} is now active.` });
  return { success: true, alreadyOwned: false, entitlementId: created[0]?.id };
}

export async function getUserById(userId: number) {
  const db = await getDb(); if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

export async function listAdminUsers() {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(500);
  const userIds = rows.map((row) => row.id);
  if (!userIds.length) return [];
  const [entitlementRows, attemptRows] = await Promise.all([
    db.select({ userId: entitlements.userId, value: count() }).from(entitlements).where(inArray(entitlements.userId, userIds)).groupBy(entitlements.userId),
    db.select({ userId: attempts.userId, value: count() }).from(attempts).where(inArray(attempts.userId, userIds)).groupBy(attempts.userId),
  ]);
  const entitlementCounts = new Map(entitlementRows.map((row) => [row.userId, Number(row.value)]));
  const attemptCounts = new Map(attemptRows.map((row) => [row.userId, Number(row.value)]));
  return rows.map(({ passwordHash, ...user }) => ({ ...user, entitlementCount: entitlementCounts.get(user.id) ?? 0, attemptCount: attemptCounts.get(user.id) ?? 0 }));
}

export async function createManagedUser(input: { email: string; name?: string; passwordHash: string; role: "user" | "instructor" }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const existing = await getUserByEmail(input.email);
  if (existing) throw new Error("An account with this email already exists");
  const openId = `local:${randomUUID()}`;
  const email = input.email.trim().toLowerCase();
  await db.insert(users).values({ openId, email, name: input.name?.trim() || null, passwordHash: input.passwordHash, loginMethod: "local", role: input.role, lastSignedIn: new Date() });
  const created = await getUserByEmail(email);
  if (!created) throw new Error("Account could not be created");
  const subject = input.role === "instructor" ? "Welcome to the content team" : "Welcome to Accountants for Tomorrow";
  const body = input.role === "instructor" ? "Your instructor account is ready. Sign in to build products, upload exam content, and manage marking." : "Your learner account was created by an administrator. Explore your allocated products and begin your exam preparation.";
  await db.insert(notifications).values({ userId: created.id, type: "account", subject, body });
  return created;
}

export async function removeUser(adminUserId: number, targetUserId: number) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  if (adminUserId === targetUserId) throw new Error("You cannot remove your own account");
  const target = await getUserById(targetUserId);
  if (!target) throw new Error("Account not found");
  if (isAdminRole(target.role)) throw new Error("Administrator accounts cannot be removed through this workflow");
  const attemptIds = (await db.select({ id: attempts.id }).from(attempts).where(eq(attempts.userId, targetUserId))).map((row) => row.id);
  if (attemptIds.length) {
    await db.delete(answers).where(inArray(answers.attemptId, attemptIds));
    await db.delete(feedbackStates).where(inArray(feedbackStates.attemptId, attemptIds));
    await db.delete(markings).where(inArray(markings.attemptId, attemptIds));
    await db.delete(submissions).where(inArray(submissions.attemptId, attemptIds));
  }
  await db.delete(attempts).where(eq(attempts.userId, targetUserId));
  await db.delete(entitlements).where(eq(entitlements.userId, targetUserId));
  await db.delete(payments).where(eq(payments.userId, targetUserId));
  await db.delete(notifications).where(eq(notifications.userId, targetUserId));
  await db.delete(users).where(eq(users.id, targetUserId));
  await db.insert(auditEvents).values({ userId: adminUserId, entityType: "user", entityId: targetUserId, action: "removed", metadata: JSON.stringify({ role: target.role, email: target.email }) });
  return { success: true };
}

export async function recordPayment(input: { userId: number; productId: number; provider: "payfast" | "stripe" | "admin"; reference?: string; amountCents: number; currency?: string; status?: "pending" | "completed" | "cancelled" | "refunded"; metadata?: Record<string, unknown> }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const created = await db.insert(payments).values({
    userId: input.userId,
    productId: input.productId,
    provider: input.provider,
    reference: input.reference?.slice(0, 120) ?? null,
    amountCents: Math.max(0, Math.round(input.amountCents)),
    currency: input.currency ?? "ZAR",
    status: input.status ?? "completed",
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  }).$returningId();
  return { id: created[0]?.id };
}

export async function listPayments() {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select({ payment: payments, user: users, product: products }).from(payments).innerJoin(users, eq(payments.userId, users.id)).leftJoin(products, eq(payments.productId, products.id)).orderBy(desc(payments.createdAt)).limit(300);
  return rows.map(({ payment, user, product }) => ({ ...payment, learnerEmail: user.email, learnerName: user.name, productTitle: product?.title ?? null }));
}

export async function adminGrantEntitlement(input: { adminUserId: number; userId: number; productId: number; accessDays?: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const student = await getUserById(input.userId);
  if (!student) throw new Error("Learner account not found");
  if (student.role !== "user") throw new Error("Access can only be allocated to registered learner accounts");
  const product = (await db.select({ id: products.id, title: products.title, category: products.category, priceCents: products.priceCents, accessDays: products.accessDays, status: products.status }).from(products).where(eq(products.id, input.productId)).limit(1))[0];
  if (!product || product.status !== "published") throw new Error("Product unavailable or not published");
  const accessDays = Number(input.accessDays) > 0 ? Math.min(3650, Math.round(input.accessDays ?? 0)) : product.accessDays;
  const startsAt = new Date();
  const expiresAt = entitlementExpiryFromAccessDays(accessDays, startsAt);
  const existing = (await db.select().from(entitlements).where(and(eq(entitlements.userId, input.userId), eq(entitlements.productId, input.productId), eq(entitlements.status, "active"))).limit(1))[0];
  if (existing) {
    await db.update(entitlements).set({ source: "admin", status: "active", grantedBy: input.adminUserId, startsAt, expiresAt }).where(eq(entitlements.id, existing.id));
  } else {
    await db.insert(entitlements).values({ userId: input.userId, productId: input.productId, source: "admin", status: "active", grantedBy: input.adminUserId, startsAt, expiresAt });
  }
  await recordPayment({ userId: input.userId, productId: input.productId, provider: "admin", reference: `admin-grant-${Date.now()}`, amountCents: product.priceCents, metadata: { grantedBy: input.adminUserId, accessDays, expiresAt: expiresAt?.toISOString() ?? null, reason: "manual-allocation" } });
  await db.insert(notifications).values({ userId: input.userId, type: "account", subject: "Exam access granted", body: `Your access to ${product.title} has been granted${expiresAt ? ` and runs until ${expiresAt.toLocaleDateString()}` : ""}.` });
  await db.insert(auditEvents).values({ userId: input.adminUserId, entityType: "entitlement", entityId: existing?.id ?? 0, action: "granted", metadata: JSON.stringify({ userId: input.userId, productId: input.productId, accessDays, expiresAt: expiresAt?.toISOString() ?? null }) });
  return { success: true, productId: input.productId, title: product.title, startsAt, expiresAt };
}

export async function revokeEntitlement(input: { adminUserId: number; entitlementId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const row = (await db.select({ id: entitlements.id, userId: entitlements.userId, product: products.title }).from(entitlements).innerJoin(products, eq(entitlements.productId, products.id)).where(eq(entitlements.id, input.entitlementId)).limit(1))[0];
  if (!row) throw new Error("Entitlement not found");
  await db.update(entitlements).set({ status: "revoked" }).where(eq(entitlements.id, input.entitlementId));
  await db.insert(notifications).values({ userId: row.userId, type: "account", subject: "Access removed", body: `Your access to ${row.product} has been removed by an administrator.` });
  await db.insert(auditEvents).values({ userId: input.adminUserId, entityType: "entitlement", entityId: input.entitlementId, action: "revoked", metadata: JSON.stringify({ product: row.product }) });
  return { success: true };
}

export async function listAdminUserEntitlements(userId: number) {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select({ entitlement: entitlements, product: products }).from(entitlements).innerJoin(products, eq(entitlements.productId, products.id)).where(eq(entitlements.userId, userId)).orderBy(desc(entitlements.createdAt));
  return rows.map((row) => ({ ...row, entitlement: { ...row.entitlement, status: hasActiveEntitlement(row.entitlement) ? "active" as const : row.entitlement.status === "revoked" ? "revoked" as const : "expired" as const } }));
}

export async function listAdminCoupons() {
  const db = await getDb(); if (!db) return [];
  const rows = await db.select({ coupon: coupons, creator: users.name, creatorEmail: users.email }).from(coupons).leftJoin(users, eq(coupons.createdBy, users.id)).orderBy(desc(coupons.createdAt));
  return rows.map(({ coupon, creator, creatorEmail }) => ({ ...coupon, createdByName: creator ?? null, createdByEmail: creatorEmail ?? null }));
}

export async function createAdminCoupon(input: { userId: number; code: string; discountType: "percent" | "fixed"; value: number; maxUses?: number; expiresAt?: string | null }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "-");
  if (!code) throw new Error("Coupon code is required");
  if (!/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(code)) throw new Error("Code must be 2-40 characters using letters, numbers and dashes");
  const value = Math.round(input.value);
  if (input.discountType === "percent") {
    if (value < 1 || value > 100) throw new Error("Percent coupons must be between 1 and 100");
  } else {
    if (value < 1) throw new Error("Fixed coupon value must be at least R0.01");
  }
  const maxUses = Math.max(0, Math.round(input.maxUses ?? 0));
  const existing = (await db.select().from(coupons).where(eq(coupons.code, code)).limit(1))[0];
  if (existing) throw new Error("A coupon with this code already exists");
  const created = await db.insert(coupons).values({
    code,
    discountType: input.discountType,
    value,
    maxUses,
    usedCount: 0,
    status: "active",
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    createdBy: input.userId,
  }).$returningId();
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "coupon", entityId: created[0]?.id ?? 0, action: "created", metadata: JSON.stringify({ code, discountType: input.discountType, value, maxUses, expiresAt: input.expiresAt ?? null }) });
  return { id: created[0]?.id };
}

export async function revokeCoupon(input: { userId: number; couponId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const coupon = (await db.select().from(coupons).where(eq(coupons.id, input.couponId)).limit(1))[0];
  if (!coupon) throw new Error("Coupon not found");
  const newStatus = coupon.status === "active" ? "disabled" : "active";
  await db.update(coupons).set({ status: newStatus }).where(eq(coupons.id, input.couponId));
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "coupon", entityId: input.couponId, action: newStatus === "disabled" ? "disabled" : "enabled", metadata: JSON.stringify({ code: coupon.code }) });
  return { success: true, status: newStatus };
}

export async function updateAdminCoupon(input: { userId: number; couponId: number; code?: string; discountType?: "percent" | "fixed"; value?: number; maxUses?: number; expiresAt?: string | null; status?: "active" | "disabled" }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const coupon = (await db.select().from(coupons).where(eq(coupons.id, input.couponId)).limit(1))[0];
  if (!coupon) throw new Error("Coupon not found");

  const updates: Partial<typeof coupons.$inferInsert> = {};
  if (input.code !== undefined) {
    const code = input.code.trim().toUpperCase().replace(/\s+/g, "-");
    if (!code) throw new Error("Coupon code is required");
    if (!/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(code)) throw new Error("Code must be 2-40 characters using letters, numbers and dashes");
    if (code !== coupon.code) {
      const dup = (await db.select().from(coupons).where(eq(coupons.code, code)).limit(1))[0];
      if (dup) throw new Error("A coupon with this code already exists");
    }
    updates.code = code;
  }
  if (input.discountType !== undefined) updates.discountType = input.discountType;
  if (input.value !== undefined) {
    const value = Math.round(input.value);
    if (input.discountType === "percent") {
      if (value < 1 || value > 100) throw new Error("Percent coupons must be between 1 and 100");
    } else {
      if (value < 1) throw new Error("Fixed coupon value must be at least R0.01");
    }
    updates.value = value;
  }
  if (input.maxUses !== undefined) updates.maxUses = Math.max(0, Math.round(input.maxUses));
  if (input.expiresAt !== undefined) updates.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (input.status !== undefined) updates.status = input.status;

  if (Object.keys(updates).length) {
    await db.update(coupons).set(updates).where(eq(coupons.id, input.couponId));
    await db.insert(auditEvents).values({ userId: input.userId, entityType: "coupon", entityId: input.couponId, action: "updated", metadata: JSON.stringify({ code: updates.code ?? coupon.code, updates }) });
  }
  return { success: true };
}

export async function deleteAdminCoupon(input: { userId: number; couponId: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const coupon = (await db.select().from(coupons).where(eq(coupons.id, input.couponId)).limit(1))[0];
  if (!coupon) throw new Error("Coupon not found");
  await db.delete(couponRedemptions).where(eq(couponRedemptions.couponId, input.couponId));
  await db.delete(coupons).where(eq(coupons.id, input.couponId));
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "coupon", entityId: input.couponId, action: "deleted", metadata: JSON.stringify({ code: coupon.code }) });
  return { success: true };
}

export type ValidatedCoupon = {
  code: string;
  discountType: "percent" | "fixed";
  value: number;
  discountCents: number;
  subtotalCents: number;
  totalCents: number;
};

export async function validateCoupon(input: { code: string; subtotalCents: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const code = input.code.trim().toUpperCase();
  const subtotal = Math.max(0, Math.round(input.subtotalCents));
  if (!code) throw new Error("Enter a coupon code");
  const coupon = (await db.select().from(coupons).where(eq(coupons.code, code)).limit(1))[0];
  if (!coupon || coupon.status !== "active") throw new Error("This coupon code is not valid");
  if (coupon.expiresAt) {
    const expires = new Date(coupon.expiresAt);
    const expiresMs = expires.getTime();
    const atMidnight = expires.getHours() === 0 && expires.getMinutes() === 0 && expires.getSeconds() === 0;
    const effectiveExpiry = atMidnight ? expiresMs + 24 * 60 * 60 * 1000 - 1 : expiresMs;
    if (effectiveExpiry < Date.now()) throw new Error("This coupon has expired");
  }
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) throw new Error("This coupon has reached its usage limit");
  const discountCents = coupon.discountType === "percent"
    ? Math.round((subtotal * coupon.value) / 100)
    : Math.min(coupon.value, subtotal);
  const totalCents = Math.max(0, subtotal - discountCents);
  return {
    code: coupon.code,
    discountType: coupon.discountType,
    value: coupon.value,
    discountCents,
    subtotalCents: subtotal,
    totalCents,
  } satisfies ValidatedCoupon;
}

export async function clickCoupon(input: { couponId: number; userId: number; amountCents: number }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const coupon = (await db.select().from(coupons).where(eq(coupons.id, input.couponId)).limit(1))[0];
  if (!coupon) throw new Error("Coupon not found");
  await db.update(coupons).set({ usedCount: coupon.usedCount + 1 }).where(eq(coupons.id, input.couponId));
  await db.insert(couponRedemptions).values({ couponId: input.couponId, userId: input.userId, amountCents: Math.round(input.amountCents) });
  return { success: true, usedCount: coupon.usedCount + 1 };
}

export async function checkoutWithCoupon(input: { userId: number; productIds: number[]; couponCode: string }) {
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const selected = await db.select().from(products).where(inArray(products.id, Array.from(new Set(input.productIds))));
  const available = selected.filter((product) => product.status === "published" && product.priceCents > 0);
  if (!available.length) throw new Error("Your cart has no paid products");
  const subtotal = available.reduce((sum, product) => sum + product.priceCents, 0);
  const validated = await validateCoupon({ code: input.couponCode, subtotalCents: subtotal });
  if (validated.totalCents > 0) throw new Error("Coupon does not cover the full amount; checkout with payment instead");
  const coupon = (await db.select().from(coupons).where(eq(coupons.code, validated.code)).limit(1))[0];
  if (!coupon) throw new Error("This coupon code is not valid");

  let granted = 0;
  const startsAt = new Date();
  for (const product of available) {
    const existing = (await db.select().from(entitlements).where(and(eq(entitlements.userId, input.userId), eq(entitlements.productId, product.id), eq(entitlements.status, "active"))).limit(1))[0];
    if (existing && hasActiveEntitlement(existing)) continue;
    await db.insert(entitlements).values({ userId: input.userId, productId: product.id, source: "admin", status: "active", startsAt, expiresAt: entitlementExpiryFromAccessDays(product.accessDays, startsAt) });
    granted += 1;
  }

  await db.update(coupons).set({ usedCount: coupon.usedCount + 1 }).where(eq(coupons.id, coupon.id));
  await db.insert(couponRedemptions).values({ couponId: coupon.id, userId: input.userId, amountCents: Math.round(validated.discountCents) });
  await recordPayment({ userId: input.userId, productId: available[0].id, provider: "admin", reference: `coupon-${coupon.code}`, amountCents: 0, metadata: { couponCode: coupon.code, couponId: coupon.id, productIds: available.map((p) => p.id), discountCents: validated.discountCents, granted, source: "coupon" } });
  await db.insert(auditEvents).values({ userId: input.userId, entityType: "coupon", entityId: coupon.id, action: "redeemed", metadata: JSON.stringify({ code: coupon.code, productIds: available.map((p) => p.id), discountCents: validated.discountCents }) });
  if (granted) await db.insert(notifications).values({ userId: input.userId, type: "purchase", subject: "Products added", body: `Your ${granted} Accountants for Tomorrow product${granted === 1 ? " is" : "s are"} now active via coupon ${coupon.code}.` });

  return { success: true, granted, couponCode: coupon.code, discountCents: validated.discountCents };
}
