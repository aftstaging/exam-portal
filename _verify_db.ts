import fs from "fs";

for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (!match) continue;
  process.env[match[1]] = match[2].trim().replace(/^"|"$/g, "");
}

const lines: string[] = [];
const log = (...parts: unknown[]) => lines.push(parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" "));

const db = await import("./server/db");

const [supervisions, instructors, users] = await Promise.all([
  db.listSupervisions(),
  db.listInstructors(),
  db.listAdminUsers(),
]);

log("listSupervisions ->", supervisions.length, "rows");
log("listInstructors ->", instructors.map((i) => ({ id: i.id, email: i.email, superviseeCount: i.superviseeCount })));
log("listAdminUsers enrolled ->", users.filter((u) => u.role === "user").slice(0, 5).map((u) => ({ id: u.id, enrolled: u.enrolled, active: u.activeEntitlementCount, total: u.entitlementCount })));

const firstInstructor = instructors[0];
const firstStudent = users.find((u) => u.role === "user");
if (firstInstructor) log("listInstructorSupervisees ->", (await db.listInstructorSupervisees(firstInstructor.id)).length, "rows");

async function expectReject(label: string, run: () => Promise<unknown>) {
  try {
    await run();
    log(label, "-> UNEXPECTED SUCCESS");
  } catch (error) {
    log(label, "->", (error as Error).message);
  }
}

await expectReject("assign(nonexistent student)", () => db.assignSupervision({ adminUserId: 1, studentId: 999999, instructorId: firstInstructor?.id ?? 1 }));
await expectReject("assign(nonexistent instructor)", () => db.assignSupervision({ adminUserId: 1, studentId: firstStudent?.id ?? 1, instructorId: 999999 }));
await expectReject("end(nonexistent)", () => db.endSupervision({ adminUserId: 1, supervisionId: 999999 }));

log("done");
fs.writeFileSync("_verify_db.out.txt", lines.join("\n"));
process.exit(0);
