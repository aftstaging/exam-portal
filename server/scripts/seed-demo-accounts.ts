/**
 * Seed demo users for the self-hosted deployment.
 *
 * Usage: DATABASE_URL=mysql://... pnpm exec tsx server/scripts/seed-demo-accounts.ts
 *
 * Idempotent: skips accounts that already exist. A registered/admin-created
 * user with the same email is left untouched (password is NOT overwritten).
 */
import "dotenv/config";
import { getDb, getUserByEmail, createLocalUser } from "../db";
import { hashPassword } from "../_core/password";

const DEMO_ACCOUNTS = [
  {
    email: "demo.admin@accountantsfortomorrow.co.za",
    password: "AdminDemo!2026",
    name: "Demo Admin",
    role: "admin" as const,
  },
  {
    email: "demo.student@accountantsfortomorrow.co.za",
    password: "StudentDemo!2026",
    name: "Demo Student",
    role: "user" as const,
  },
  {
    email: "demo.instructor@accountantsfortomorrow.co.za",
    password: "InstructorDemo!2026",
    name: "Demo Instructor",
    role: "instructor" as const,
  },
];

async function main() {
  const db = await getDb();
  if (!db) {
    throw new Error("DATABASE_URL must be set to an existing MySQL database");
  }

  for (const account of DEMO_ACCOUNTS) {
    const exists = await getUserByEmail(account.email);
    if (exists) {
      console.log(`skip  ${account.email} (already exists)`);
      continue;
    }
    const user = await createLocalUser({
      email: account.email,
      name: account.name,
      passwordHash: await hashPassword(account.password),
      role: account.role,
    });
    console.log(`seed  ${account.email} (id=${user.id}, role=${user.role})`);
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});