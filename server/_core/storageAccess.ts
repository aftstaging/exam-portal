import { and, eq, or } from "drizzle-orm";
import { getDb } from "../db";
import { attempts, entitlements, mockExams, objectiveQuestions, products, resources, supervisions, users } from "../../drizzle/schema";
import { hasActiveEntitlement, isAdminRole } from "@shared/integrity";

/**
 * Decides whether a viewer may read a stored object, by the kind of file it is.
 *
 * The storage proxy used to sign and redirect any key to anyone who asked, so a student could read
 * another student's submission or a protected exam file by guessing its path. Every key is now
 * checked against the relationship it stands for:
 *
 * - product images are public, because the catalogue shows them to visitors;
 * - avatars are visible to the person themselves, their supervisor, and staff;
 * - submissions are visible to the learner who wrote them and to instructors who supervise them;
 * - exam files (resources, printable papers, question attachments) need an active entitlement;
 * - anything else is for administrators only.
 *
 * A denial is reported to the browser as "not found", so the response does not confirm that a
 * key exists.
 */
export type StorageViewer = { id: number; role: string } | null;

const PUBLIC_PREFIXES = new Set(["product-images"]);
const KNOWN_PREFIXES = new Set(["avatars", "submissions", "admin-resources", "mock-exams", "objective-attachments", "exams"]);
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._\-/]{0,511}$/;

export async function canReadStorageKey(viewer: StorageViewer, key: string): Promise<boolean> {
  if (!SAFE_KEY.test(key) || key.includes("..") || key.includes("//")) return false;
  const [prefix, rawId] = key.split("/");
  if (!prefix) return false;
  if (PUBLIC_PREFIXES.has(prefix)) return true;
  // Unknown prefixes are refused for everyone, administrators included, so nothing outside the known layout can be read.
  if (!KNOWN_PREFIXES.has(prefix)) return false;
  if (!viewer) return false;
  if (isAdminRole(viewer.role)) return true;
  const staff = viewer.role === "instructor";
  const db = await getDb();
  if (!db) return false;
  const id = Number(rawId);

  const supervises = async (learnerId: number) => {
    const [row] = await db
      .select({ id: supervisions.id })
      .from(supervisions)
      .where(and(eq(supervisions.instructorId, viewer.id), eq(supervisions.studentId, learnerId), eq(supervisions.status, "active")))
      .limit(1);
    return Boolean(row);
  };

  const entitledTo = async (productId: number) => {
    const rows = await db
      .select()
      .from(entitlements)
      .where(and(eq(entitlements.userId, viewer.id), eq(entitlements.productId, productId), eq(entitlements.status, "active")));
    return rows.some((row) => hasActiveEntitlement(row));
  };

  // Same rule as the resource download path: free products are open to any signed-in viewer, paid ones need an entitlement.
  const productAccess = async (productId: number) => {
    if (staff) return true;
    const [product] = await db.select({ priceCents: products.priceCents }).from(products).where(eq(products.id, productId)).limit(1);
    if (!product) return false;
    if ((product.priceCents ?? 0) <= 0) return true;
    return entitledTo(productId);
  };

  switch (prefix) {
    case "avatars": {
      if (!Number.isInteger(id) || id <= 0) return false;
      if (id === viewer.id) return true;
      // Staff photos appear across the portal, for example on a learner's instructor card.
      const [owner] = await db.select({ role: users.role }).from(users).where(eq(users.id, id)).limit(1);
      if (owner && owner.role !== "user") return true;
      return supervises(id);
    }
    case "submissions": {
      if (!Number.isInteger(id) || id <= 0) return false;
      const [attempt] = await db.select({ userId: attempts.userId }).from(attempts).where(eq(attempts.id, id)).limit(1);
      if (!attempt) return false;
      if (attempt.userId === viewer.id) return true;
      return staff && (await supervises(attempt.userId));
    }
    case "admin-resources": {
      if (!Number.isInteger(id) || id <= 0) return false;
      const [resource] = await db
        .select({ id: resources.id, status: resources.status })
        .from(resources)
        .where(and(
          eq(resources.productId, id),
          or(eq(resources.fileKey, key), eq(resources.fileUrl, `/storage/${key}`)),
        ))
        .limit(1);
      if (!resource) return false;
      if (staff) return true;
      // A product entitlement is not enough on its own: draft and archived resource rows must
      // remain private even when the learner can read other material from the same product.
      if (resource.status !== "published") return false;
      return productAccess(id);
    }
    case "mock-exams": {
      if (!Number.isInteger(id) || id <= 0) return false;
      const [exam] = await db.select({ productId: mockExams.productId, status: mockExams.status }).from(mockExams).where(eq(mockExams.id, id)).limit(1);
      if (!exam) return false;
      if (!staff && exam.status !== "published") return false;
      const [resource] = await db
        .select({ id: resources.id, status: resources.status })
        .from(resources)
        .where(and(eq(resources.productId, exam.productId), eq(resources.fileKey, key)))
        .limit(1);
      if (!resource) return false;
      if (staff) return true;
      if (resource.status !== "published") return false;
      return productAccess(exam.productId);
    }
    case "objective-attachments": {
      if (!Number.isInteger(id) || id <= 0) return false;
      const [exam] = await db.select({ productId: mockExams.productId, status: mockExams.status }).from(mockExams).where(eq(mockExams.id, id)).limit(1);
      if (!exam) return false;
      if (staff) return true;
      if (exam.status !== "published") return false;
      const [question] = await db
        .select({ id: objectiveQuestions.id })
        .from(objectiveQuestions)
        .where(and(
          eq(objectiveQuestions.mockExamId, id),
          eq(objectiveQuestions.status, "published"),
          eq(objectiveQuestions.attachmentUrl, `/storage/${key}`),
        ))
        .limit(1);
      if (!question) return false;
      return productAccess(exam.productId);
    }
    case "exams": {
      // Seeded source PDFs. Each one belongs to a resource row, so the rule is the resource's own: free products are open,
      // paid ones need an entitlement, and learners only see published material.
      const [hit] = await db
        .select({ status: resources.status, productId: products.id })
        .from(resources)
        .innerJoin(products, eq(resources.productId, products.id))
        .where(eq(resources.fileKey, key))
        .limit(1);
      if (!hit) return false;
      if (staff) return true;
      if (hit.status !== "published") return false;
      return productAccess(hit.productId);
    }
    default:
      return false;
  }
}
