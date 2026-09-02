import crypto from "node:crypto";
import type { Express } from "express";
import { ENV } from "./_core/env";
import { getDb, recordPayment } from "./db";
import { entitlements, notifications, products } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { entitlementExpiryFromAccessDays, shouldGrantPurchasedEntitlement } from "@shared/payments";

export type PayFastMode = "sandbox" | "live";
export type PayFastCheckoutFields = Record<string, string>;

function config(mode: PayFastMode) {
  return mode === "live"
    ? { merchantId: ENV.payfastLiveMerchantId, merchantKey: ENV.payfastLiveMerchantKey, passphrase: ENV.payfastLivePassphrase, endpoint: "https://www.payfast.co.za/eng/process" }
    : { merchantId: ENV.payfastSandboxMerchantId, merchantKey: ENV.payfastSandboxMerchantKey, passphrase: ENV.payfastSandboxPassphrase, endpoint: "https://sandbox.payfast.co.za/eng/process" };
}

export function payFastIsConfigured(mode: PayFastMode = ENV.payfastMode) {
  const current = config(mode);
  return Boolean(current.merchantId && current.merchantKey);
}

export function payFastEndpoint(mode: PayFastMode = ENV.payfastMode) {
  return config(mode).endpoint;
}

export function createPayFastSignature(fields: PayFastCheckoutFields, passphrase?: string) {
  const encoded = Object.entries(fields)
    .filter(([key, value]) => key !== "signature" && value !== "" && value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%20/g, "+")}`)
    .join("&");
  const source = passphrase ? `${encoded}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, "+")}` : encoded;
  return crypto.createHash("md5").update(source).digest("hex");
}

export function buildPayFastCheckout(fields: PayFastCheckoutFields, mode: PayFastMode = ENV.payfastMode): { endpoint: string; fields: PayFastCheckoutFields } | null {
  const current = config(mode);
  if (!current.merchantId || !current.merchantKey) return null;
  const payload = { merchant_id: current.merchantId, merchant_key: current.merchantKey, ...fields };
  return { endpoint: current.endpoint, fields: { ...payload, signature: createPayFastSignature(payload, current.passphrase) } };
}

export function verifyPayFastITN(fields: PayFastCheckoutFields, mode: PayFastMode = ENV.payfastMode) {
  const current = config(mode);
  if (!current.merchantId || !current.merchantKey || !fields.signature) return false;
  if (fields.merchant_id !== current.merchantId) return false;
  return createPayFastSignature(fields, current.passphrase) === fields.signature;
}

export function createPayFastHostedCheckout(input: { productId: number; userId: number; email?: string | null; name?: string | null; origin: string; mode: PayFastMode; amount: string; itemName: string; extraFields?: PayFastCheckoutFields }) {
  if (!payFastIsConfigured(input.mode)) return null;
  const fields: PayFastCheckoutFields = {
    return_url: `${input.origin}/dashboard?payment=success`,
    cancel_url: `${input.origin}/mock-exams?payment=cancelled`,
    notify_url: `${input.origin}/api/payfast/itn`,
    name_first: (input.name ?? "Learner").split(" ")[0] || "Learner",
    email_address: input.email ?? "",
    m_payment_id: `aft-${input.userId}-${input.productId}-${Date.now()}`,
    amount: input.amount,
    item_name: input.itemName,
    custom_str1: String(input.userId),
    custom_str2: String(input.productId),
    ...(input.extraFields ?? {}),
  };
  return buildPayFastCheckout(fields, input.mode);
}

export function registerPayFastITN(app: Express, getMode: () => Promise<PayFastMode>) {
  app.post("/api/payfast/itn", async (req, res) => {
    const fields = Object.fromEntries(Object.entries(req.body ?? {}).map(([key, value]) => [key, String(value ?? "")]));
    const mode = await getMode();
    if (!verifyPayFastITN(fields, mode) || fields.payment_status !== "COMPLETE") return res.status(400).json({ error: "Invalid PayFast notification" });
    const userId = Number(fields.custom_str1);
    const productIds = (fields.custom_str3 ?? fields.custom_str2).split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0);
    if (!Number.isInteger(userId) || !productIds.length) return res.status(400).json({ error: "Invalid purchase metadata" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });
    let granted = 0;
    for (const productId of productIds) {
      const existing = await db.select().from(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.productId, productId), eq(entitlements.status, "active"))).limit(1);
      const product = (await db.select({ accessDays: products.accessDays }).from(products).where(eq(products.id, productId)).limit(1))[0];
      if (product && shouldGrantPurchasedEntitlement(Boolean(existing[0]))) {
        const startsAt = new Date();
        await db.insert(entitlements).values({ userId, productId, source: "purchase", status: "active", startsAt, expiresAt: entitlementExpiryFromAccessDays(product.accessDays, startsAt) });
        granted += 1;
      }
    }
    if (granted) await db.insert(notifications).values({ userId, type: "purchase", subject: "Purchase confirmed", body: `Your ${granted} Accountants for Tomorrow product${granted === 1 ? " is" : "s are"} now active.` });
    await recordPayment({
      userId,
      productId: productIds[0],
      provider: "payfast",
      reference: fields.m_payment_id,
      amountCents: Math.round(Number(fields.amount) * 100) || 0,
      status: "completed",
      metadata: { productIds, granted, mode, transactionId: fields.pf_payment_id },
    });
    return res.json({ received: true, granted });
  });
}
