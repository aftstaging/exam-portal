/**
 * Reconcile production accounts.
 *
 * Production never seeds demo accounts. This script only *updates existing*
 * accounts:
 *
 *   - `admin@accountantsfortomorrow.co.za`      -> role `admin`
 *   - `instructor@accountantsfortomorrow.co.za` -> role `instructor`
 *   - every known demo/QA account               -> login disabled
 *
 * Nothing is created and nothing is deleted: users, attempts, entitlements and
 * all other history are preserved. Disabled accounts keep their rows but can no
 * longer sign in (password login is refused and existing sessions are
 * rejected).
 *
 * Usage:
 *   # 1. preview (no writes)
 *   DATABASE_URL=mysql://... pnpm exec tsx server/scripts/reconcile-production-accounts.ts
 *
 *   # 2. back up the database, then apply
 *   DATABASE_URL=mysql://... pnpm exec tsx server/scripts/reconcile-production-accounts.ts --apply
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { getDb, getUserByEmail } from "../db";
import { DEMO_LEARNER_EMAIL, DISABLED_LOGIN_METHOD, isLoginDisabled } from "@shared/const";

type StaffExpectation = { email: string; role: "admin" | "instructor" };

const STAFF_ACCOUNTS: StaffExpectation[] = [
  { email: "admin@accountantsfortomorrow.co.za", role: "admin" },
  { email: "instructor@accountantsfortomorrow.co.za", role: "instructor" },
];

const DEMO_ACCOUNT_EMAILS = [
  DEMO_LEARNER_EMAIL,
  "demo.admin@accountantsfortomorrow.co.za",
  "demo.student@accountantsfortomorrow.co.za",
  "demo.instructor@accountantsfortomorrow.co.za",
];

type Action = { email: string; change: string };

async function main() {
  const apply = process.argv.includes("--apply");
  const db = await getDb();
  if (!db) {
    throw new Error("DATABASE_URL must be set to an existing MySQL database");
  }

  const planned: Action[] = [];
  const missing: string[] = [];
  const unchanged: string[] = [];

  for (const staff of STAFF_ACCOUNTS) {
    const user = await getUserByEmail(staff.email);
    if (!user) {
      missing.push(staff.email);
      continue;
    }
    const needsRole = user.role !== staff.role;
    const needsEnable = isLoginDisabled(user.loginMethod);
    if (!needsRole && !needsEnable) {
      unchanged.push(`${staff.email} (role=${user.role})`);
      continue;
    }
    planned.push({
      email: staff.email,
      change: needsRole ? `role ${user.role} -> ${staff.role}` : "re-enable login",
    });
    if (apply) {
      const set: Record<string, unknown> = { role: staff.role };
      if (needsEnable) set.loginMethod = "local";
      await db.update(users).set(set).where(eq(users.id, user.id));
    }
  }

  for (const email of DEMO_ACCOUNT_EMAILS) {
    const user = await getUserByEmail(email);
    if (!user) continue;
    if (isLoginDisabled(user.loginMethod)) {
      unchanged.push(`${email} (login already disabled)`);
      continue;
    }
    planned.push({ email, change: `login ${user.loginMethod ?? "unset"} -> ${DISABLED_LOGIN_METHOD}` });
    if (apply) {
      await db.update(users).set({ loginMethod: DISABLED_LOGIN_METHOD }).where(eq(users.id, user.id));
    }
  }

  console.log(apply ? "Applying production account reconciliation:" : "Preview only (re-run with --apply to write):");
  for (const action of planned) console.log(`  ${apply ? "updated" : "would update"}  ${action.email}: ${action.change}`);
  if (!planned.length) console.log("  nothing to change");
  for (const item of unchanged) console.log(`  ok       ${item}`);
  for (const email of missing) console.log(`  MISSING  ${email} (not created by this script — create it manually)`);

  if (!apply) {
    console.log("\nNo changes were written. Back up the database, then re-run with --apply.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
