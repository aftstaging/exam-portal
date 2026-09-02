import express, { type Express } from "express";
import Stripe from "stripe";
import { getDb, recordPayment } from "./db";
import { entitlements, notifications, products } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { entitlementExpiryFromAccessDays, shouldGrantPurchasedEntitlement } from "@shared/payments";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export function registerStripeWebhook(app: Express) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: "Stripe is not configured" });
    let event: Stripe.Event;
    try { event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"] as string, process.env.STRIPE_WEBHOOK_SECRET); }
    catch { return res.status(400).json({ error: "Invalid webhook signature" }); }
    if (event.id.startsWith("evt_test_")) return res.json({ verified: true });
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = Number(session.metadata?.user_id);
      const productId = Number(session.metadata?.product_id);
      if (Number.isInteger(userId) && Number.isInteger(productId)) {
        const db = await getDb();
        if (db) {
          const existing = await db.select().from(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.productId, productId), eq(entitlements.status, "active"))).limit(1);
          const product = (await db.select({ accessDays: products.accessDays, priceCents: products.priceCents }).from(products).where(eq(products.id, productId)).limit(1))[0];
          if (shouldGrantPurchasedEntitlement(Boolean(existing[0]))) {
            const startsAt = new Date();
            await db.insert(entitlements).values({ userId, productId, source: "purchase", status: "active", startsAt, expiresAt: entitlementExpiryFromAccessDays(product?.accessDays, startsAt) });
            await recordPayment({ userId, productId, provider: "stripe", reference: session.id, amountCents: session.amount_total ?? product?.priceCents ?? 0, status: "completed", metadata: { checkout: session.id, customer: session.customer ?? undefined } });
            await db.insert(notifications).values({ userId, type: "purchase", subject: "Purchase confirmed", body: "Your Accountants for Tomorrow access is now active." });
          }
        }
      }
    }
    return res.json({ received: true });
  });
}

export async function createCheckoutSession(input: { userId: number; email?: string | null; name?: string | null; productId: number; origin: string }) {
  if (!stripe) throw new Error("Stripe is not configured");
  const db = await getDb(); if (!db) throw new Error("Database unavailable");
  const rows = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
  const product = rows[0];
  if (!product || product.status !== "published") throw new Error("Product unavailable");
  if (product.priceCents <= 0) throw new Error("This product does not require payment");
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: input.email ?? undefined,
    client_reference_id: String(input.userId),
    allow_promotion_codes: true,
    line_items: [{ price_data: { currency: "zar", product_data: { name: product.title, description: product.description ?? undefined }, unit_amount: product.priceCents }, quantity: 1 }],
    metadata: { user_id: String(input.userId), product_id: String(product.id), customer_email: input.email ?? "", customer_name: input.name ?? "" },
    success_url: `${input.origin}/dashboard?payment=success`,
    cancel_url: `${input.origin}/mock-exams?payment=cancelled`,
  });
  return { url: session.url };
}
