import "dotenv/config";
import { getDb } from "../server/db";
import { hashPassword } from "../server/_core/password";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("no db");
  const email = "dev-instructor@aft.local";
  const existing = (await db.select().from(users).where(eq(users.email, email)))[0];
  if (existing) {
    await db.update(users).set({ role: "instructor", passwordHash: hashPassword("afttest1234") }).where(eq(users.id, existing.id));
    console.log("updated", existing.id);
  } else {
    const rows = await db.insert(users).values({
      openId: `dev-instructor-${Date.now()}`,
      email,
      name: "Dev Instructor",
      passwordHash: hashPassword("afttest1234"),
      loginMethod: "local",
      role: "instructor",
    });
    console.log("created", rows[0].insertId);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});