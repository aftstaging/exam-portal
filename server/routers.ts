import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { assignMarking, createLockedSubmission, getAdminContentOverview, getAdminOverview, getAttemptContext, getProtectedResourceDownload, getUserFeedbackStates, listAdminContent, listAdminProducts, listAdminUsers, listMarkerQueue, listPayments, listProtectedResources, listPublishedCaseStudySections, listPublishedMockExams, listPublishedObjectiveQuestions, listPublishedProducts, listPublishedQualifications, listUserAttempts, listUserEntitlements, listUserNotifications, markNotificationRead, releaseFeedback, saveAnswerDraft, startCaseStudyAttempt, generatePrintablePdf, updateAdminContentStatus, updateProductStatus, updateSectionTitle, getPayFastGatewaySettings, setPayFastGatewayMode, updateProductAccessDays, updateProductPrice, createAdminProduct, createAdminMockExam, createAdminObjectiveQuestion, uploadAdminResource, claimFreeProduct, provisionDemoLearner, getUserByEmail, createLocalUser, createManagedUser, removeUser, adminGrantEntitlement, revokeEntitlement, listAdminUserEntitlements, updateUserLastSignedIn, updateAdminProduct, uploadProductImage, updateAdminObjectiveQuestionRationale, createExamBundle, listAdminCoupons, createAdminCoupon, revokeCoupon, updateAdminCoupon, deleteAdminCoupon, validateCoupon, checkoutWithCoupon, getAdminExamPreview } from "./db";
import { createCheckoutSession } from "./stripe";
import { isAdminRole } from "@shared/integrity";
import { getDb } from "./db";
import { products } from "../drizzle/schema";
import { createPayFastHostedCheckout, type PayFastMode } from "./payfast";
import { eq, inArray } from "drizzle-orm";
import { hashPassword, verifyPassword } from "./_core/password";
import { sdk } from "./_core/sdk";
import { ONE_YEAR_MS } from "@shared/const";
import { type User } from "../drizzle/schema";
import { staffProcedure } from "./_core/trpc";

function toSafeUser(user: User) {
  const { passwordHash, ...safe } = user;
  return safe;
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdminRole(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access required" });
  return next();
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => (opts.ctx.user ? toSafeUser(opts.ctx.user) : null)),
    logout: publicProcedure.mutation(({ ctx }) => { ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 }); return { success: true } as const; }),
    login: publicProcedure.input(z.object({ email: z.string().email().max(320), password: z.string().min(8).max(200) })).mutation(async ({ ctx, input }) => {
      const user = await getUserByEmail(input.email);
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      if (!verifyPassword(input.password, user.passwordHash)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
      }
      await updateUserLastSignedIn(user.id);
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: ONE_YEAR_MS });
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      return toSafeUser(user);
    }),
    register: publicProcedure.input(z.object({ email: z.string().email().max(320), password: z.string().min(8).max(200), name: z.string().min(1).max(200).optional() })).mutation(async ({ ctx, input }) => {
      const existing = await getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists" });
      }
      const passwordHash = hashPassword(input.password);
      const user = await createLocalUser({ email: input.email, name: input.name, passwordHash });
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: ONE_YEAR_MS });
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
      return toSafeUser(user);
    }),
  }),
  catalogue: router({
    products: publicProcedure.query(() => listPublishedProducts()),
    qualifications: publicProcedure.query(() => listPublishedQualifications()),
    mockExams: publicProcedure.query(() => listPublishedMockExams()),
    caseStudySections: publicProcedure.input(z.object({ mockExamId: z.number().int().positive() })).query(({ input }) => listPublishedCaseStudySections(input.mockExamId)),
    objectiveQuestions: publicProcedure.input(z.object({ mockExamId: z.number().int().positive().optional() }).optional()).query(({ input }) => listPublishedObjectiveQuestions(input?.mockExamId)),
  }),
  student: router({
    entitlements: protectedProcedure.query(({ ctx }) => listUserEntitlements(ctx.user.id)),
    attempts: protectedProcedure.query(({ ctx }) => listUserAttempts(ctx.user.id)),
    notifications: protectedProcedure.query(({ ctx }) => listUserNotifications(ctx.user.id)),
    feedback: protectedProcedure.query(({ ctx }) => getUserFeedbackStates(ctx.user.id)),
    markNotificationRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(({ ctx, input }) => markNotificationRead(ctx.user.id, input.notificationId)),
  }),
  resources: router({
    list: protectedProcedure.input(z.object({ productId: z.number().int().positive() })).query(({ ctx, input }) => listProtectedResources(ctx.user.id, input.productId)),
    download: protectedProcedure.input(z.object({ resourceId: z.number().int().positive() })).query(({ ctx, input }) => getProtectedResourceDownload(ctx.user.id, input.resourceId)),
  }),
  exams: router({
    startAttempt: protectedProcedure.input(z.object({ mockExamId: z.number().int().positive(), mode: z.enum(["interactive", "printable", "solutions", "feedback"]) })).mutation(({ ctx, input }) => startCaseStudyAttempt({ ...input, userId: ctx.user.id })),
    attemptContext: protectedProcedure.input(z.object({ attemptId: z.number().int().positive() })).query(({ ctx, input }) => getAttemptContext(ctx.user.id, input.attemptId)),
    saveAnswer: protectedProcedure.input(z.object({ attemptId: z.number().int().positive(), sectionId: z.number().int().positive(), body: z.string().max(100000), wordCount: z.number().int().min(0).max(100000) })).mutation(({ ctx, input }) => saveAnswerDraft({ ...input, userId: ctx.user.id })),
    submit: protectedProcedure.input(z.object({ attemptId: z.number().int().positive(), optOutOfMarking: z.boolean() })).mutation(({ ctx, input }) => createLockedSubmission({ ...input, userId: ctx.user.id })),
  }),
  payments: router({
    createCheckout: protectedProcedure.input(z.object({ productId: z.number().int().positive() })).mutation(({ ctx, input }) => createCheckoutSession({ userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name, productId: input.productId, origin: `${ctx.req.protocol}://${ctx.req.get("host")}` })),
    createPayfastCartCheckout: protectedProcedure.input(z.object({ productIds: z.array(z.number().int().positive()).min(1).max(20), couponCode: z.string().max(40).optional() })).mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable" });
      const selected = await db.select().from(products).where(inArray(products.id, Array.from(new Set(input.productIds))));
      const available = selected.filter((product) => product.status === "published" && product.priceCents > 0);
      if (!available.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Your cart has no paid products" });
      const subtotal = available.reduce((sum, product) => sum + product.priceCents, 0);
      let amountCents = subtotal;
      let couponCode: string | null = null;
      if (input.couponCode) {
        try {
          const validated = await validateCoupon({ code: input.couponCode, subtotalCents: subtotal });
          amountCents = validated.totalCents;
          couponCode = validated.code;
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Invalid coupon code" });
        }
      }
      if (amountCents <= 0 && couponCode) {
        try {
          const result = await checkoutWithCoupon({ userId: ctx.user.id, productIds: available.map((product) => product.id), couponCode });
          return { noPayment: true, granted: result.granted, couponCode: result.couponCode };
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Could not apply coupon" });
        }
      }
      const settings = await getPayFastGatewaySettings();
      const checkout = createPayFastHostedCheckout({ productId: available[0].id, userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name, origin: `${ctx.req.protocol}://${ctx.req.get("host")}`, mode: settings.mode as PayFastMode, amount: (amountCents / 100).toFixed(2), itemName: `AFT cart · ${available.length} product${available.length === 1 ? "" : "s"}`, extraFields: { custom_str3: available.map((product) => product.id).join(","), ...(couponCode ? { custom_str4: couponCode } : {}) } });
      if (!checkout) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PayFast is not configured for the selected gateway mode" });
      return checkout;
    }),
    validateCoupon: protectedProcedure.input(z.object({ code: z.string().min(1).max(40), subtotalCents: z.number().int().min(0) })).mutation(async ({ input }) => {
      try {
        return await validateCoupon({ code: input.code, subtotalCents: input.subtotalCents });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Invalid coupon code" });
      }
    }),
    claimFreeProduct: protectedProcedure.input(z.object({ productId: z.number().int().positive() })).mutation(({ ctx, input }) => claimFreeProduct({ userId: ctx.user.id, productId: input.productId })),
    createPayfastCheckout: protectedProcedure.input(z.object({ productId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Database unavailable" });
      const product = (await db.select().from(products).where(eq(products.id, input.productId)).limit(1))[0];
      if (!product || product.status !== "published") throw new TRPCError({ code: "NOT_FOUND", message: "Product unavailable" });
      if (product.priceCents <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "This product does not require payment" });
      const settings = await getPayFastGatewaySettings();
      const checkout = createPayFastHostedCheckout({ productId: product.id, userId: ctx.user.id, email: ctx.user.email, name: ctx.user.name, origin: `${ctx.req.protocol}://${ctx.req.get("host")}`, mode: settings.mode as PayFastMode, amount: (product.priceCents / 100).toFixed(2), itemName: product.title });
      if (!checkout) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PayFast is not configured for the selected gateway mode" });
      return checkout;
    }),
  }),
  admin: router({
    overview: adminProcedure.query(() => getAdminOverview()),
    products: staffProcedure.query(() => listAdminProducts()),
    contentOverview: staffProcedure.query(() => getAdminContentOverview()),
    examPreview: staffProcedure.input(z.object({ mockExamId: z.number().int().positive() })).query(({ input }) => getAdminExamPreview(input.mockExamId)),
    contentItems: staffProcedure.input(z.object({ kind: z.enum(["mock_exams", "sections", "resources", "objective_questions"]) })).query(({ input }) => listAdminContent(input.kind)),
    updateContentStatus: staffProcedure.input(z.object({ kind: z.enum(["mock_exams", "resources", "objective_questions"]), id: z.number().int().positive(), status: z.enum(["draft", "published", "archived"]) })).mutation(({ ctx, input }) => updateAdminContentStatus({ ...input, userId: ctx.user.id })),
    updateSectionTitle: staffProcedure.input(z.object({ sectionId: z.number().int().positive(), title: z.string().min(1).max(240) })).mutation(({ ctx, input }) => updateSectionTitle({ ...input, userId: ctx.user.id })),
    updateProductStatus: staffProcedure.input(z.object({ productId: z.number().int().positive(), status: z.enum(["draft", "published", "archived"]) })).mutation(({ ctx, input }) => updateProductStatus({ ...input, userId: ctx.user.id })),
    generatePrintablePdf: staffProcedure.input(z.object({ mockExamId: z.number().int().positive() })).mutation(({ ctx, input }) => generatePrintablePdf(ctx.user.id, input.mockExamId)),
    payfastSettings: adminProcedure.query(() => getPayFastGatewaySettings()),
    setPayfastMode: adminProcedure.input(z.object({ mode: z.enum(["sandbox", "live"]) })).mutation(({ ctx, input }) => setPayFastGatewayMode(ctx.user.id, input.mode)),
    updateAccessDays: staffProcedure.input(z.object({ productId: z.number().int().positive(), accessDays: z.number().int().min(1).max(3650) })).mutation(({ ctx, input }) => updateProductAccessDays({ ...input, userId: ctx.user.id })),
    updatePrice: staffProcedure.input(z.object({ productId: z.number().int().positive(), priceCents: z.number().int().min(0) })).mutation(({ ctx, input }) => updateProductPrice({ ...input, userId: ctx.user.id })),
    createProduct: staffProcedure.input(z.object({ title: z.string().min(1).max(240), category: z.enum(["case_study", "objective_test", "marking", "resource"]), description: z.string().max(5000).optional(), featuredImageUrl: z.string().url().max(1000).optional(), priceCents: z.number().int().min(0), accessDays: z.number().int().min(1).max(3650).default(30) })).mutation(({ ctx, input }) => createAdminProduct({ ...input, userId: ctx.user.id })),
    updateProduct: staffProcedure.input(z.object({ productId: z.number().int().positive(), title: z.string().min(1).max(240), category: z.enum(["case_study", "objective_test", "marking", "resource"]), description: z.string().max(5000).optional().nullable(), featuredImageUrl: z.string().url().max(1000).optional().nullable(), priceCents: z.number().int().min(0), accessDays: z.number().int().min(1).max(3650) })).mutation(({ ctx, input }) => updateAdminProduct({ ...input, description: input.description ?? undefined, featuredImageUrl: input.featuredImageUrl ?? undefined, userId: ctx.user.id })),
    uploadProductImage: staffProcedure.input(z.object({ productId: z.number().int().positive(), fileName: z.string().min(1).max(240), mimeType: z.string().max(120), base64: z.string().min(1).max(15000000) })).mutation(({ ctx, input }) => uploadProductImage({ ...input, userId: ctx.user.id })),
    createMockExam: staffProcedure.input(z.object({ productId: z.number().int().positive(), title: z.string().min(1).max(240), examType: z.enum(["case_study", "objective_test"]), intro: z.string().max(5000).optional(), totalDurationSeconds: z.number().int().min(60).max(86400) })).mutation(({ ctx, input }) => createAdminMockExam({ ...input, userId: ctx.user.id })),
    createExamBundle: staffProcedure.input(z.object({
      title: z.string().min(1).max(240),
      examType: z.enum(["case_study", "objective_test"]),
      intro: z.string().max(5000).optional(),
      description: z.string().max(5000).optional(),
      priceCents: z.number().int().min(0),
      accessDays: z.number().int().min(1).max(3650),
      totalDurationSeconds: z.number().int().min(60).max(86400),
      featuredImageUrl: z.string().url().max(1000).optional(),
      featuredImage: z.object({ fileName: z.string().min(1).max(240), mimeType: z.string().max(120), base64: z.string().max(15000000) }).optional(),
      preModeratedPdf: z.object({ fileName: z.string().min(1).max(240), mimeType: z.string().max(120), base64: z.string().max(28000000) }).optional(),
      preSeen: z.object({ fileName: z.string().min(1).max(240), mimeType: z.string().max(120), base64: z.string().max(28000000) }).optional(),
      formulae: z.object({ fileName: z.string().min(1).max(240), mimeType: z.string().max(120), base64: z.string().max(28000000) }).optional(),
      reference: z.object({ fileName: z.string().min(1).max(240), mimeType: z.string().max(120), base64: z.string().max(28000000) }).optional(),
      emailFrom: z.string().max(320).optional(),
      emailTo: z.string().max(320).optional(),
      emailSubject: z.string().max(500).optional(),
      emailText: z.string().max(50000).optional(),
      emailImage: z.object({ fileName: z.string().min(1).max(240), mimeType: z.string().max(120), base64: z.string().max(28000000) }).optional(),
      caseStudySections: z.array(z.object({
        sectionNumber: z.number().int().min(1).max(100),
        title: z.string().max(240),
        introduction: z.string().max(10000).optional(),
        scenario: z.string().max(100000).optional(),
        question: z.string().max(100000).optional(),
        durationSeconds: z.number().int().min(60).max(86400),
        cooldownSeconds: z.number().int().min(0).max(86400).optional(),
      })).max(100).optional(),
      feedbackText: z.string().max(100000).optional(),
      feedbackFile: z.object({ fileName: z.string().min(1).max(240), mimeType: z.string().max(120), base64: z.string().max(28000000) }).optional(),
      objectiveQuestions: z.array(z.object({
        topic: z.string().max(180),
        prompt: z.string().max(10000),
        questionType: z.enum(["single_choice", "multiple_choice", "dropdown", "numerical", "text_input"]).optional(),
        options: z.array(z.string().min(0).max(1000)).min(0).max(8),
        correct: z.number().int().min(0),
        explanation: z.string().max(5000).optional(),
        rationale: z.array(z.string().min(0).max(1000)).max(8).optional(),
        attachment: z.object({ fileName: z.string().min(1).max(240), mimeType: z.string().max(120), base64: z.string().max(28000000) }).optional(),
      })).max(200).optional(),
    })).mutation(({ ctx, input }) => createExamBundle({ ...input, userId: ctx.user.id })),
    createObjectiveQuestion: staffProcedure.input(z.object({ mockExamId: z.number().int().positive(), topic: z.string().min(1).max(180), prompt: z.string().min(1).max(10000), options: z.array(z.string().min(1).max(1000)).min(2).max(8), correct: z.number().int().min(0), questionType: z.enum(["single_choice", "multiple_choice", "dropdown", "numerical", "text_input"]).optional(), explanation: z.string().max(5000).optional(), rationale: z.array(z.string().max(1000)).max(8).optional(), difficulty: z.enum(["easy", "medium", "hard"]), attachmentBase64: z.string().max(15_000_000).optional(), attachmentFileName: z.string().max(240).optional(), attachmentMimeType: z.string().max(120).optional() })).mutation(({ ctx, input }) => createAdminObjectiveQuestion({ ...input, userId: ctx.user.id })),
    updateObjectiveQuestionRationale: staffProcedure.input(z.object({ questionId: z.number().int().positive(), rationale: z.array(z.string().max(1000)).max(8) })).mutation(({ ctx, input }) => updateAdminObjectiveQuestionRationale({ ...input, userId: ctx.user.id })),
    uploadResource: staffProcedure.input(z.object({ productId: z.number().int().positive(), title: z.string().max(240), kind: z.enum(["pre_seen", "formulae", "printable_pdf", "feedback", "course_material", "reference"]), fileName: z.string().min(1).max(240), mimeType: z.string().max(120), base64: z.string().min(1).max(28000000) })).mutation(({ ctx, input }) => uploadAdminResource({ ...input, userId: ctx.user.id })),
    provisionDemoLearner: adminProcedure.mutation(({ ctx }) => provisionDemoLearner(ctx.user.id)),
    users: adminProcedure.query(() => listAdminUsers()),
    createStudent: adminProcedure.input(z.object({ email: z.string().email().max(320), password: z.string().min(8).max(200), name: z.string().min(1).max(200).optional() })).mutation(({ ctx, input }) => createManagedUser({ email: input.email, name: input.name, passwordHash: hashPassword(input.password), role: "user" })),
    createInstructor: adminProcedure.input(z.object({ email: z.string().email().max(320), password: z.string().min(8).max(200), name: z.string().min(1).max(200).optional() })).mutation(({ ctx, input }) => createManagedUser({ email: input.email, name: input.name, passwordHash: hashPassword(input.password), role: "instructor" })),
    removeUser: adminProcedure.input(z.object({ userId: z.number().int().positive() })).mutation(({ ctx, input }) => removeUser(ctx.user.id, input.userId)),
    payments: adminProcedure.query(() => listPayments()),
    grantAccess: adminProcedure.input(z.object({ userId: z.number().int().positive(), productId: z.number().int().positive(), accessDays: z.number().int().min(1).max(3650).optional() })).mutation(({ ctx, input }) => adminGrantEntitlement({ adminUserId: ctx.user.id, userId: input.userId, productId: input.productId, accessDays: input.accessDays })),
    revokeAccess: adminProcedure.input(z.object({ entitlementId: z.number().int().positive() })).mutation(({ ctx, input }) => revokeEntitlement({ adminUserId: ctx.user.id, entitlementId: input.entitlementId })),
    learnerEntitlements: adminProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ input }) => listAdminUserEntitlements(input.userId)),
    coupons: adminProcedure.query(() => listAdminCoupons()),
    createCoupon: adminProcedure.input(z.object({ code: z.string().min(1).max(40), discountType: z.enum(["percent", "fixed"]), value: z.number().int().min(0), maxUses: z.number().int().min(0).optional(), expiresAt: z.string().datetime().nullable().optional() })).mutation(({ ctx, input }) => createAdminCoupon({ userId: ctx.user.id, code: input.code, discountType: input.discountType, value: input.value, maxUses: input.maxUses, expiresAt: input.expiresAt })),
    revokeCoupon: adminProcedure.input(z.object({ couponId: z.number().int().positive() })).mutation(({ ctx, input }) => revokeCoupon({ userId: ctx.user.id, couponId: input.couponId })),
    updateCoupon: adminProcedure.input(z.object({ couponId: z.number().int().positive(), code: z.string().min(1).max(40).optional(), discountType: z.enum(["percent", "fixed"]).optional(), value: z.number().int().min(0).optional(), maxUses: z.number().int().min(0).optional(), expiresAt: z.string().datetime().nullable().optional(), status: z.enum(["active", "disabled"]).optional() })).mutation(({ ctx, input }) => updateAdminCoupon({ userId: ctx.user.id, couponId: input.couponId, code: input.code, discountType: input.discountType, value: input.value, maxUses: input.maxUses, expiresAt: input.expiresAt, status: input.status })),
    deleteCoupon: adminProcedure.input(z.object({ couponId: z.number().int().positive() })).mutation(({ ctx, input }) => deleteAdminCoupon({ userId: ctx.user.id, couponId: input.couponId })),
  }),
  marking: router({
    queue: staffProcedure.query(() => listMarkerQueue()),
    assign: staffProcedure.input(z.object({ markingId: z.number().int().positive(), markerId: z.number().int().positive() })).mutation(({ input }) => assignMarking(input)),
    release: staffProcedure.input(z.object({ markingId: z.number().int().positive(), feedback: z.string().min(1).max(100000), rubricSnapshot: z.string().max(100000).optional(), awardedPoints: z.number().int().min(0), totalPoints: z.number().int().positive() })).mutation(({ input }) => releaseFeedback(input)),
  }),
});

export type AppRouter = typeof appRouter;
