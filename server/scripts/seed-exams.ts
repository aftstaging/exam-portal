/**
 * Exam catalogue import for self-hosted deployments (EC2).
 *
 * Two things are required for the deployed portal to show exams:
 *   1. The catalogue METADATA (products, mock exams, sections, questions)
 *      must be written to MySQL.
 *   2. The source exam PDFs must be uploaded to S3 and linked to the matching
 *      protected resource rows so learners can actually download them.
 *
 * This script does both. It is idempotent: the SQL import files guard every
 * INSERT with WHERE NOT EXISTS, and PDF uploads replace existing file keys.
 *
 * Usage (run in /opt/aft-learning-portal with the production .env loaded):
 *   pnpm exec tsx server/scripts/seed-exams.ts
 *
 * Environment: DATABASE_URL (MySQL) and the S3 variables (AWS_REGION, S3_BUCKET
 * and either an IAM role or AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).
 */
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "mysql2/promise";
import { eq } from "drizzle-orm";
import { storagePut } from "../storage";
import { getDb } from "../db";
import { resources } from "../../drizzle/schema";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const PROJECT_ROOT = join(__dirname, "..", "..");

const IMPORT_FILES = [
  "drizzle/import-sample-exams.sql",
  "drizzle/import-objective-tests.sql",
];

// Map each imported resource (matched by title) to the local source PDF that
// should be uploaded to S3 and attached to it.
const SOURCE_PDF_BY_RESOURCE_TITLE: Record<string, string> = {
  "Cartn Mock Exam 3 — Question paper": "source-pdfs/cartn-mock-3-questions.pdf",
  "Cartn Mock Exam 3 — Suggested solutions": "source-pdfs/cartn-mock-3-solutions.pdf",
  "Cartn Mock Exam 4 — Question paper": "source-pdfs/cartn-mock-4-questions.pdf",
  "Cartn Mock Exam 4 — Suggested solutions": "source-pdfs/cartn-mock-4-solutions.pdf",
  "Mock B — May & August 2026 question paper": "source-pdfs/cima-mock-b-questions.pdf",
  "Mock B — Answers and marking guide": "source-pdfs/cima-mock-b-answers-marking-guide.pdf",
};

async function runSqlFile(conn: Awaited<ReturnType<typeof createConnection>>, file: string) {
  const absolute = join(PROJECT_ROOT, file);
  const sql = readFileSync(absolute, "utf-8");
  console.log(`==> Importing ${file}`);
  await conn.query(sql);
  console.log(`    done.`);
}

async function attachSourcePdfs() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL must be set to an existing MySQL database");

  const all = await db.select().from(resources);
  let attached = 0;

  for (const [title, relPath] of Object.entries(SOURCE_PDF_BY_RESOURCE_TITLE)) {
    const row = all.find((r) => r.title === title);
    if (!row) {
      console.warn(`    ! no resource row found for title "${title}"`);
      continue;
    }
    const absolute = join(PROJECT_ROOT, relPath);
    const bytes = readFileSync(absolute);
    const uploaded = await storagePut(`exams/${relPath.split("/").pop()}`, bytes, "application/pdf");
    await db.update(resources).set({ fileKey: uploaded.key, fileUrl: uploaded.url }).where(eq(resources.id, row.id));
    console.log(`    + attached ${relPath} -> ${uploaded.key}`);
    attached++;
  }

  console.log(`    ${attached} of ${Object.keys(SOURCE_PDF_BY_RESOURCE_TITLE).length} source PDFs attached.`);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL must be set");

  const conn = await createConnection({ uri: dbUrl, multipleStatements: true });
  try {
    for (const file of IMPORT_FILES) {
      await runSqlFile(conn, file);
    }
  } finally {
    await conn.end();
  }

  console.log("==> Attaching source PDFs to resources");
  await attachSourcePdfs();

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
