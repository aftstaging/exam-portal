import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, inArray, isNull, or, asc } from "drizzle-orm";
import { getDb, getUserById } from "./db";
import { notifyUser } from "./notifications";
import { storagePut } from "./storage";
import { isAdminRole } from "@shared/integrity";
import { isEnrolled } from "@shared/supervision";
import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  matchesImageSignature,
  normalizeProfileInput,
  PROFILE_LIMITS,
  submissionStatusLabel,
  summarizePerformance,
  scorePercent,
  type ProfileInput,
} from "@shared/performance";
import {
  answers,
  attempts,
  caseStudySections,
  entitlements,
  markings,
  messages,
  mockExams,
  notifications,
  submissionComments,
  submissions,
  supervisions,
  userProfiles,
  users,
  feedbackStates,
} from "../drizzle/schema";

type Role = "user" | "instructor" | "admin";

const SUBMITTED_STATUSES = ["submitted", "awaiting_marking", "marked"] as const;

function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable" });
  return db;
}

/** Converts a stored avatar key into the storage proxy path the browser loads. */
function avatarPath(avatarKey: string | null | undefined): string | null {
  return avatarKey ? `/storage/${avatarKey}` : null;
}

function emptyProfile(userId: number) {
  return {
    userId,
    bio: null as string | null,
    phone: null as string | null,
    headline: null as string | null,
    employer: null as string | null,
    city: null as string | null,
    country: null as string | null,
    dateOfBirth: null as string | null,
    linkedinUrl: null as string | null,
    targetQualification: null as string | null,
    emergencyContactName: null as string | null,
    emergencyContactPhone: null as string | null,
    avatarUrl: null as string | null,
    updatedAt: null as Date | null,
  };
}

function shapeProfile(userId: number, row: typeof userProfiles.$inferSelect | undefined) {
  if (!row) return emptyProfile(userId);
  return {
    userId,
    bio: row.bio,
    phone: row.phone,
    headline: row.headline,
    employer: row.employer,
    city: row.city,
    country: row.country,
    dateOfBirth: row.dateOfBirth,
    linkedinUrl: row.linkedinUrl,
    targetQualification: row.targetQualification,
    emergencyContactName: row.emergencyContactName,
    emergencyContactPhone: row.emergencyContactPhone,
    avatarUrl: avatarPath(row.avatarKey),
    updatedAt: row.updatedAt,
  };
}

export async function getMyProfile(userId: number) {
  const db = requireDb(await getDb());
  const user = await getUserById(userId);
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Account not found" });
  const [row] = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt, lastSignedIn: user.lastSignedIn },
    profile: shapeProfile(userId, row),
  };
}

export async function updateMyProfile(userId: number, input: ProfileInput) {
  const db = requireDb(await getDb());
  const clean = normalizeProfileInput(input);
  if (clean.name !== undefined) {
    if (!clean.name) throw new TRPCError({ code: "BAD_REQUEST", message: "Name cannot be empty" });
    if (clean.name.length > PROFILE_LIMITS.name) throw new TRPCError({ code: "BAD_REQUEST", message: "Name is too long" });
    await db.update(users).set({ name: clean.name }).where(eq(users.id, userId));
  }
  const { name: _name, ...fields } = clean;
  const values = {
    bio: fields.bio ?? null,
    phone: fields.phone ?? null,
    headline: fields.headline ?? null,
    employer: fields.employer ?? null,
    city: fields.city ?? null,
    country: fields.country ?? null,
    dateOfBirth: fields.dateOfBirth ?? null,
    linkedinUrl: fields.linkedinUrl ?? null,
    targetQualification: fields.targetQualification ?? null,
    emergencyContactName: fields.emergencyContactName ?? null,
    emergencyContactPhone: fields.emergencyContactPhone ?? null,
  };
  const [existing] = await db.select({ id: userProfiles.id }).from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  if (existing) await db.update(userProfiles).set(values).where(eq(userProfiles.userId, userId));
  else await db.insert(userProfiles).values({ userId, ...values });
  return getMyProfile(userId);
}

export async function uploadAvatar(userId: number, input: { fileName: string; mimeType: string; base64: string }) {
  const db = requireDb(await getDb());
  const extension = AVATAR_MIME_TYPES[input.mimeType];
  if (!extension) throw new TRPCError({ code: "BAD_REQUEST", message: "Profile photos must be PNG, JPEG, WebP or GIF" });
  const payload = input.base64.includes(",") ? input.base64.slice(input.base64.indexOf(",") + 1) : input.base64;
  const bytes = Buffer.from(payload, "base64");
  if (!bytes.length) throw new TRPCError({ code: "BAD_REQUEST", message: "The selected photo is empty" });
  if (bytes.length > AVATAR_MAX_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: "Profile photos must be 5 MB or smaller" });
  if (!matchesImageSignature(bytes, input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "That file is not a valid image" });

  const uploaded = await storagePut(`avatars/${userId}/profile.${extension}`, bytes, input.mimeType);
  const [existing] = await db.select({ id: userProfiles.id }).from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  if (existing) await db.update(userProfiles).set({ avatarKey: uploaded.key, avatarUrl: uploaded.url }).where(eq(userProfiles.userId, userId));
  else await db.insert(userProfiles).values({ userId, avatarKey: uploaded.key, avatarUrl: uploaded.url });
  return { avatarUrl: avatarPath(uploaded.key) };
}

/** Attempts (with their exam and marking) for a set of learners, newest first. */
async function loadAttemptRecords(userIds: number[], filter?: { attemptId?: number }) {
  const db = await getDb();
  if (!db || !userIds.length) return [];
  const where = and(
    inArray(attempts.userId, userIds),
    filter?.attemptId ? eq(attempts.id, filter.attemptId) : undefined,
  );
  const rows = await db
    .select({ attempt: attempts, exam: mockExams })
    .from(attempts)
    .innerJoin(mockExams, eq(attempts.mockExamId, mockExams.id))
    .where(where)
    .orderBy(desc(attempts.updatedAt));
  if (!rows.length) return [];
  const attemptIds = rows.map((row) => row.attempt.id);
  const [markingRows, submissionRows, commentRows] = await Promise.all([
    db.select().from(markings).where(inArray(markings.attemptId, attemptIds)),
    db.select().from(submissions).where(inArray(submissions.attemptId, attemptIds)),
    db.select({ attemptId: submissionComments.attemptId, visible: submissionComments.visibleToLearner, value: count() })
      .from(submissionComments)
      .where(inArray(submissionComments.attemptId, attemptIds))
      .groupBy(submissionComments.attemptId, submissionComments.visibleToLearner),
  ]);
  const markingByAttempt = new Map<number, typeof markingRows[number]>();
  for (const marking of markingRows) {
    const current = markingByAttempt.get(marking.attemptId);
    if (!current || marking.id > current.id) markingByAttempt.set(marking.attemptId, marking);
  }
  const submittedAttempts = new Set(submissionRows.map((row) => row.attemptId));
  const commentsByAttempt = new Map<number, { total: number; visible: number }>();
  for (const row of commentRows) {
    const bucket = commentsByAttempt.get(row.attemptId) ?? { total: 0, visible: 0 };
    bucket.total += Number(row.value);
    if (row.visible) bucket.visible += Number(row.value);
    commentsByAttempt.set(row.attemptId, bucket);
  }
  return rows.map(({ attempt, exam }) => {
    const marking = markingByAttempt.get(attempt.id) ?? null;
    const submitted = Boolean(submittedAttempts.has(attempt.id) || SUBMITTED_STATUSES.includes(attempt.status as (typeof SUBMITTED_STATUSES)[number]));
    const percent = marking && marking.status === "submitted" ? scorePercent(marking.awardedPoints, marking.totalPoints) : null;
    const awaitingMarking = submitted && attempt.status === "awaiting_marking" && !(marking && marking.status === "submitted");
    const optedOut = Boolean(attempt.optOutOfMarking);
    return {
      attemptId: attempt.id,
      userId: attempt.userId,
      examId: exam.id,
      examTitle: exam.title,
      examType: exam.examType,
      mode: attempt.mode,
      status: attempt.status,
      statusLabel: submissionStatusLabel(attempt.status, marking?.status ?? null, optedOut),
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      optedOutOfMarking: optedOut,
      submitted,
      awaitingMarking,
      markingStatus: marking?.status ?? null,
      awardedPoints: marking?.awardedPoints ?? null,
      totalPoints: marking?.totalPoints ?? null,
      percent,
      markedAt: marking?.markedAt ?? null,
      comments: commentsByAttempt.get(attempt.id) ?? { total: 0, visible: 0 },
      date: attempt.submittedAt ?? attempt.startedAt ?? attempt.createdAt,
    };
  });
}

export async function getLearnerPerformance(userId: number) {
  const records = await loadAttemptRecords([userId]);
  const history = records.map((record) => ({ ...record, visibleCommentCount: record.comments.visible }));
  const summary = summarizePerformance(
    records.map((record) => ({ submitted: record.submitted, awaitingMarking: record.awaitingMarking, percent: record.percent, date: record.date })),
  );
  const supervisor = await getActiveSupervisor(userId);
  return { summary, history, supervisor };
}

async function getActiveSupervisor(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select({ instructor: users, supervision: supervisions })
    .from(supervisions)
    .innerJoin(users, eq(supervisions.instructorId, users.id))
    .where(and(eq(supervisions.studentId, userId), eq(supervisions.status, "active")))
    .limit(1);
  if (!row) return null;
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, row.instructor.id)).limit(1);
  return {
    id: row.instructor.id,
    name: row.instructor.name,
    email: row.instructor.email,
    headline: profile?.headline ?? null,
    avatarUrl: avatarPath(profile?.avatarKey),
    supervisionId: row.supervision.id,
  };
}

/** Whether `actor` may see or act on `learnerId`: admins always, instructors only for their active learners. */
async function assertCanActOnLearner(actor: { id: number; role: Role }, learnerId: number) {
  if (isAdminRole(actor.role)) return;
  const db = requireDb(await getDb());
  const [row] = await db
    .select({ id: supervisions.id })
    .from(supervisions)
    .where(and(eq(supervisions.instructorId, actor.id), eq(supervisions.studentId, learnerId), eq(supervisions.status, "active")))
    .limit(1);
  if (!row) throw new TRPCError({ code: "FORBIDDEN", message: "This learner is not assigned to you" });
}

async function loadLearnerSummaries(learnerIds: number[]) {
  const db = await getDb();
  if (!db || !learnerIds.length) return new Map<number, { summary: ReturnType<typeof summarizePerformance> }>();
  const records = await loadAttemptRecords(learnerIds);
  const byLearner = new Map<number, typeof records>();
  for (const record of records) {
    const bucket = byLearner.get(record.userId) ?? [];
    bucket.push(record);
    byLearner.set(record.userId, bucket);
  }
  return new Map(
    learnerIds.map((id) => [
      id,
      {
        summary: summarizePerformance((byLearner.get(id) ?? []).map((record) => ({ submitted: record.submitted, awaitingMarking: record.awaitingMarking, percent: record.percent, date: record.date }))),
      },
    ]),
  );
}

/**
 * The instructor's home: their learners with profile and performance figures, the submissions from
 * those learners, and overall performance figures across the whole group.
 */
export async function getInstructorDashboard(actor: { id: number; role: Role }) {
  const db = requireDb(await getDb());
  const learnerRows = isAdminRole(actor.role)
    ? await db
        .select({ supervisionId: supervisions.id, learner: users, instructorId: supervisions.instructorId })
        .from(supervisions)
        .innerJoin(users, eq(supervisions.studentId, users.id))
        .where(eq(supervisions.status, "active"))
        .orderBy(asc(users.name))
    : await db
        .select({ supervisionId: supervisions.id, learner: users, instructorId: supervisions.instructorId })
        .from(supervisions)
        .innerJoin(users, eq(supervisions.studentId, users.id))
        .where(and(eq(supervisions.instructorId, actor.id), eq(supervisions.status, "active")))
        .orderBy(asc(users.name));
  const learnerIds = Array.from(new Set(learnerRows.map((row) => row.learner.id)));
  const [profileRows, entitlementRows, summaries, records] = await Promise.all([
    learnerIds.length ? db.select().from(userProfiles).where(inArray(userProfiles.userId, learnerIds)) : Promise.resolve([]),
    learnerIds.length ? db.select({ userId: entitlements.userId, status: entitlements.status, startsAt: entitlements.startsAt, expiresAt: entitlements.expiresAt }).from(entitlements).where(inArray(entitlements.userId, learnerIds)) : Promise.resolve([]),
    loadLearnerSummaries(learnerIds),
    loadAttemptRecords(learnerIds),
  ]);
  const profileByUser = new Map(profileRows.map((row) => [row.userId, row]));
  const enrolment = new Map<number, typeof entitlementRows>();
  for (const row of entitlementRows) {
    const bucket = enrolment.get(row.userId) ?? [];
    bucket.push(row);
    enrolment.set(row.userId, bucket);
  }
  const students = learnerRows.map((row) => {
    const profile = profileByUser.get(row.learner.id);
    return {
      supervisionId: row.supervisionId,
      id: row.learner.id,
      name: row.learner.name,
      email: row.learner.email,
      phone: profile?.phone ?? null,
      avatarUrl: avatarPath(profile?.avatarKey),
      enrolled: isEnrolled(enrolment.get(row.learner.id) ?? []),
      lastSignedIn: row.learner.lastSignedIn,
      performance: summaries.get(row.learner.id)?.summary ?? summarizePerformance([]),
    };
  });
  const everyone = summarizePerformance(records.map((record) => ({ submitted: record.submitted, awaitingMarking: record.awaitingMarking, percent: record.percent, date: record.date })));
  const submissionList = records.filter((record) => record.submitted).slice(0, 200).map((record) => {
    const learner = learnerRows.find((row) => row.learner.id === record.userId)?.learner;
    return { ...record, learner: learner ? { id: learner.id, name: learner.name, email: learner.email } : null };
  });
  return {
    totals: {
      learners: students.length,
      submissions: everyone.submitted,
      awaitingMarking: everyone.awaitingMarking,
      marked: everyone.marked,
      averagePercent: everyone.averagePercent,
      passRate: everyone.passRate,
    },
    students,
    submissions: submissionList,
    trend: everyone.trend,
  };
}

export async function getInstructorSubmission(actor: { id: number; role: Role }, attemptId: number) {
  const db = requireDb(await getDb());
  const [row] = await db.select({ attempt: attempts, exam: mockExams }).from(attempts).innerJoin(mockExams, eq(attempts.mockExamId, mockExams.id)).where(eq(attempts.id, attemptId)).limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
  await assertCanActOnLearner(actor, row.attempt.userId);

  const [learner] = await db.select().from(users).where(eq(users.id, row.attempt.userId)).limit(1);
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, row.attempt.userId)).limit(1);
  const [sectionRows, answerRows, markingRows, commentRows, feedbackRows] = await Promise.all([
    db.select().from(caseStudySections).where(eq(caseStudySections.mockExamId, row.exam.id)).orderBy(asc(caseStudySections.sectionNumber)),
    db.select().from(answers).where(eq(answers.attemptId, attemptId)).orderBy(asc(answers.sectionId)),
    db.select().from(markings).where(eq(markings.attemptId, attemptId)).orderBy(desc(markings.id)),
    db.select().from(submissionComments).where(eq(submissionComments.attemptId, attemptId)).orderBy(asc(submissionComments.createdAt)),
    db.select().from(feedbackStates).where(eq(feedbackStates.attemptId, attemptId)).orderBy(desc(feedbackStates.id)),
  ]);
  const authorIds = Array.from(new Set(commentRows.map((comment) => comment.authorId)));
  const authors = authorIds.length ? await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(inArray(users.id, authorIds)) : [];
  const authorById = new Map(authors.map((author) => [author.id, author]));
  const history = await loadAttemptRecords([row.attempt.userId]);
  const learnerSummary = summarizePerformance(history.map((record) => ({ submitted: record.submitted, awaitingMarking: record.awaitingMarking, percent: record.percent, date: record.date })));

  return {
    attempt: { ...row.attempt, optOutOfMarking: Boolean(row.attempt.optOutOfMarking) },
    statusLabel: submissionStatusLabel(row.attempt.status, markingRows[0]?.status ?? null, Boolean(row.attempt.optOutOfMarking)),
    exam: { id: row.exam.id, title: row.exam.title, examType: row.exam.examType, totalDurationSeconds: row.exam.totalDurationSeconds },
    learner: {
      id: row.attempt.userId,
      name: learner?.name ?? null,
      email: learner?.email ?? null,
      phone: profile?.phone ?? null,
      avatarUrl: avatarPath(profile?.avatarKey),
      headline: profile?.headline ?? null,
      performance: learnerSummary,
    },
    answers: answerRows.map((answer) => {
      const section = sectionRows.find((item) => item.sectionNumber === answer.sectionId);
      return { sectionId: answer.sectionId, title: section?.title ?? `Task ${answer.sectionId}`, body: answer.body, wordCount: answer.wordCount, savedAt: answer.savedAt };
    }),
    marking: markingRows[0] ?? null,
    feedback: feedbackRows[0] ?? null,
    comments: commentRows.map((comment) => ({
      id: comment.id,
      body: comment.body,
      visibleToLearner: Boolean(comment.visibleToLearner),
      createdAt: comment.createdAt,
      author: authorById.get(comment.authorId) ? { id: comment.authorId, name: authorById.get(comment.authorId)!.name, role: authorById.get(comment.authorId)!.role } : null,
      mine: comment.authorId === actor.id,
    })),
    previousAttempts: history.filter((record) => record.attemptId !== attemptId).map((record) => ({ attemptId: record.attemptId, examTitle: record.examTitle, statusLabel: record.statusLabel, percent: record.percent, date: record.date })),
  };
}

export async function addSubmissionComment(actor: { id: number; role: Role; name?: string | null }, input: { attemptId: number; body: string; visibleToLearner: boolean }) {
  const db = requireDb(await getDb());
  const body = input.body.trim();
  if (!body) throw new TRPCError({ code: "BAD_REQUEST", message: "Write a comment before saving" });
  const [attempt] = await db.select({ id: attempts.id, userId: attempts.userId, mockExamId: attempts.mockExamId }).from(attempts).where(eq(attempts.id, input.attemptId)).limit(1);
  if (!attempt) throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
  await assertCanActOnLearner(actor, attempt.userId);
  await db.insert(submissionComments).values({ attemptId: attempt.id, authorId: actor.id, body, visibleToLearner: input.visibleToLearner ? 1 : 0 });
  if (input.visibleToLearner) {
    const [exam] = await db.select({ title: mockExams.title }).from(mockExams).where(eq(mockExams.id, attempt.mockExamId)).limit(1);
    await notifyUser(db, {
      userId: attempt.userId,
      type: "comment",
      subject: "New feedback on your submission",
      body: `${actor.name ?? "Your instructor"} left a comment on your submission for ${exam?.title ?? "your exam"}:\n\n${body.slice(0, 500)}`,
      link: `/profile?attempt=${attempt.id}`,
    });
  }
  return { success: true };
}

export async function gradeSubmission(actor: { id: number; role: Role; name?: string | null }, input: { attemptId: number; awardedPoints: number; totalPoints: number; feedback: string }) {
  const db = requireDb(await getDb());
  if (input.awardedPoints > input.totalPoints) throw new TRPCError({ code: "BAD_REQUEST", message: "Awarded marks cannot exceed the total available" });
  const [attempt] = await db.select().from(attempts).where(eq(attempts.id, input.attemptId)).limit(1);
  if (!attempt) throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
  await assertCanActOnLearner(actor, attempt.userId);
  if (attempt.status === "in_progress" || attempt.status === "not_started") throw new TRPCError({ code: "BAD_REQUEST", message: "The learner has not submitted this attempt yet" });
  const feedback = input.feedback.trim();
  const [existing] = await db.select().from(markings).where(eq(markings.attemptId, attempt.id)).orderBy(desc(markings.id)).limit(1);
  const now = new Date();
  if (existing) {
    await db.update(markings).set({ markerId: actor.id, status: "submitted", awardedPoints: input.awardedPoints, totalPoints: input.totalPoints, feedback, markedAt: now }).where(eq(markings.id, existing.id));
  } else {
    await db.insert(markings).values({ attemptId: attempt.id, markerId: actor.id, status: "submitted", awardedPoints: input.awardedPoints, totalPoints: input.totalPoints, feedback, markedAt: now });
  }
  await db.update(attempts).set({ status: "marked" }).where(eq(attempts.id, attempt.id));
  await db.insert(feedbackStates).values({ attemptId: attempt.id, state: "available", summary: feedback.slice(0, 2000), releasedAt: now });
  const percent = scorePercent(input.awardedPoints, input.totalPoints);
  await notifyUser(db, {
    userId: attempt.userId,
    type: "marking",
    subject: "Your submission has been marked",
    body: `${actor.name ?? "Your instructor"} has marked your submission${percent != null ? `: ${percent}%` : ""}. Open your profile to read the feedback.`,
    link: `/profile?attempt=${attempt.id}`,
  });
  return { success: true, percent };
}

// ---------------------------------------------------------------- messaging

async function canMessage(sender: { id: number; role: Role }, recipientId: number): Promise<boolean> {
  if (sender.id === recipientId) return false;
  if (isAdminRole(sender.role)) return true;
  const db = requireDb(await getDb());
  if (sender.role === "instructor") {
    const [row] = await db.select({ id: supervisions.id }).from(supervisions).where(and(eq(supervisions.instructorId, sender.id), eq(supervisions.studentId, recipientId), eq(supervisions.status, "active"))).limit(1);
    return Boolean(row);
  }
  const [row] = await db.select({ id: supervisions.id }).from(supervisions).where(and(eq(supervisions.studentId, sender.id), eq(supervisions.instructorId, recipientId), eq(supervisions.status, "active"))).limit(1);
  return Boolean(row);
}

export async function sendMessage(sender: { id: number; name?: string | null; role: Role }, input: { recipientId: number; body: string }) {
  const db = requireDb(await getDb());
  const body = input.body.trim();
  if (!body) throw new TRPCError({ code: "BAD_REQUEST", message: "Write a message before sending" });
  if (body.length > 5000) throw new TRPCError({ code: "BAD_REQUEST", message: "Messages are limited to 5,000 characters" });
  if (!(await canMessage(sender, input.recipientId))) throw new TRPCError({ code: "FORBIDDEN", message: "You can message your supervising instructor or your assigned learners only" });
  const [recipient] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, input.recipientId)).limit(1);
  if (!recipient) throw new TRPCError({ code: "NOT_FOUND", message: "Recipient not found" });
  const created = await db.insert(messages).values({ senderId: sender.id, recipientId: recipient.id, body }).$returningId();
  const name = sender.name ?? "A message";
  await notifyUser(db, {
    userId: recipient.id,
    type: "message",
    subject: `New message from ${name}`,
    body: body.slice(0, 500),
    link: recipient.role === "user" ? "/profile?tab=messages" : "/instructor?tab=messages",
  });
  return { id: created[0]?.id ?? null };
}

export async function listConversations(userId: number) {
  const db = requireDb(await getDb());
  const rows = await db.select().from(messages).where(or(eq(messages.senderId, userId), eq(messages.recipientId, userId))).orderBy(desc(messages.createdAt)).limit(500);
  const byPartner = new Map<number, { partnerId: number; last: typeof rows[number]; unread: number }>();
  for (const row of rows) {
    const partnerId = row.senderId === userId ? row.recipientId : row.senderId;
    const bucket = byPartner.get(partnerId) ?? { partnerId, last: row, unread: 0 };
    if (row.recipientId === userId && !row.readAt) bucket.unread += 1;
    byPartner.set(partnerId, bucket);
  }
  const partnerIds = Array.from(byPartner.keys());
  const partners = partnerIds.length ? await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(inArray(users.id, partnerIds)) : [];
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
  return Array.from(byPartner.values())
    .map((bucket) => ({
      partner: partnerById.get(bucket.partnerId) ?? { id: bucket.partnerId, name: null, email: null, role: "user" as const },
      lastMessage: { body: bucket.last.body, createdAt: bucket.last.createdAt, fromMe: bucket.last.senderId === userId },
      unread: bucket.unread,
    }))
    .sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());
}

export async function listThread(userId: number, partnerId: number) {
  const db = requireDb(await getDb());
  const rows = await db
    .select()
    .from(messages)
    .where(or(and(eq(messages.senderId, userId), eq(messages.recipientId, partnerId)), and(eq(messages.senderId, partnerId), eq(messages.recipientId, userId))))
    .orderBy(asc(messages.createdAt))
    .limit(300);
  await db.update(messages).set({ readAt: new Date() }).where(and(eq(messages.senderId, partnerId), eq(messages.recipientId, userId), isNull(messages.readAt)));
  return rows.map((row) => ({ id: row.id, body: row.body, createdAt: row.createdAt, fromMe: row.senderId === userId, readAt: row.readAt }));
}

export async function unreadMessageCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db.select({ value: count() }).from(messages).where(and(eq(messages.recipientId, userId), isNull(messages.readAt)));
  return Number(row?.value ?? 0);
}

/** The learner's own submission for the history view, with the feedback they are allowed to see. */
export async function getLearnerSubmissionDetail(userId: number, attemptId: number) {
  const db = requireDb(await getDb());
  const [attempt] = await db.select().from(attempts).where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId))).limit(1);
  if (!attempt) throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
  const [exam] = await db.select({ id: mockExams.id, title: mockExams.title, examType: mockExams.examType }).from(mockExams).where(eq(mockExams.id, attempt.mockExamId)).limit(1);
  const [markingRow] = await db.select().from(markings).where(eq(markings.attemptId, attemptId)).orderBy(desc(markings.id)).limit(1);
  const comments = await db.select().from(submissionComments).where(and(eq(submissionComments.attemptId, attemptId), eq(submissionComments.visibleToLearner, 1))).orderBy(asc(submissionComments.createdAt));
  const authorIds = Array.from(new Set(comments.map((comment) => comment.authorId)));
  const authors = authorIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, authorIds)) : [];
  const authorName = new Map(authors.map((author) => [author.id, author.name]));
  const sections = await db.select().from(caseStudySections).where(eq(caseStudySections.mockExamId, attempt.mockExamId)).orderBy(asc(caseStudySections.sectionNumber));
  const answerRows = await db.select().from(answers).where(eq(answers.attemptId, attemptId)).orderBy(asc(answers.sectionId));
  return {
    attemptId,
    examTitle: exam?.title ?? "Exam",
    examType: exam?.examType ?? "case_study",
    status: attempt.status,
    statusLabel: submissionStatusLabel(attempt.status, markingRow?.status ?? null, Boolean(attempt.optOutOfMarking)),
    submittedAt: attempt.submittedAt,
    percent: markingRow?.status === "submitted" ? scorePercent(markingRow.awardedPoints, markingRow.totalPoints) : null,
    awardedPoints: markingRow?.status === "submitted" ? markingRow.awardedPoints : null,
    totalPoints: markingRow?.status === "submitted" ? markingRow.totalPoints : null,
    feedback: markingRow?.status === "submitted" ? markingRow.feedback : null,
    markedAt: markingRow?.markedAt ?? null,
    comments: comments.map((comment) => ({ id: comment.id, body: comment.body, createdAt: comment.createdAt, authorName: authorName.get(comment.authorId) ?? "Instructor" })),
    answers: answerRows.map((answer) => ({ sectionId: answer.sectionId, title: sections.find((item) => item.sectionNumber === answer.sectionId)?.title ?? `Task ${answer.sectionId}`, body: answer.body, wordCount: answer.wordCount })),
  };
}

/** Learner-facing profile of an instructor, for the supervisor card. */
export async function getInstructorPublicCard(instructorId: number) {
  const db = requireDb(await getDb());
  const [user] = await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.id, instructorId)).limit(1);
  if (!user) return null;
  const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, instructorId)).limit(1);
  return { id: user.id, name: user.name, role: user.role, headline: profile?.headline ?? null, bio: profile?.bio ?? null, avatarUrl: avatarPath(profile?.avatarKey) };
}

