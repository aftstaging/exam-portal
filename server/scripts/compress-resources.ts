/**
 * Re-compress every stored PDF resource (question papers, pre-seen briefs,
 * formulae, reference material, feedback guides) so the in-app PDF viewer opens
 * faster. Replaces each row's fileKey with the compressed copy; rows whose PDF
 * is already small are left untouched. Safe to re-run.
 *
 * Usage (run in /opt/aft-learning-portal with the production .env loaded):
 *   pnpm exec tsx server/scripts/compress-resources.ts
 *
 * Environment: DATABASE_URL (MySQL), AWS_REGION, S3_BUCKET and credentials,
 * plus the Ghostscript binary `gs` (sudo apt install ghostscript).
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { resources } from "../../drizzle/schema";
import { storageGetBytes, storagePut } from "../storage";
import { compressPdfSource } from "../pdfCompress";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL must be set to an existing MySQL database");

  const all = await db.select().from(resources);
  const pdfs = all.filter((row) => row.fileKey?.toLowerCase().endsWith(".pdf"));

  let compressed = 0;
  let failed = 0;

  for (const row of pdfs) {
    try {
      const { body } = await storageGetBytes(row.fileKey!);
      const smaller = await compressPdfSource(body);
      if (smaller.length >= body.length) {
        console.log(`   = "${row.title}" already small (${(body.length / 1024).toFixed(0)} KB)`);
        continue;
      }
      const name = row.fileKey!.split("/").pop() ?? "attachment.pdf";
      const uploaded = await storagePut(
        `compressed-resources/${Date.now()}-${name}`,
        smaller,
        "application/pdf",
      );
      await db.update(resources).set({ fileKey: uploaded.key, fileUrl: uploaded.url }).where(eq(resources.id, row.id));
      console.log(`   + "${row.title}" ${(body.length / 1024 / 1024).toFixed(1)} MB -> ${(smaller.length / 1024 / 1024).toFixed(1)} MB`);
      compressed++;
    } catch (error) {
      failed++;
      console.error(`   ! "${row.title}" failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(`\n${pdfs.length} PDF resources scanned; ${compressed} compressed, ${pdfs.length - compressed - failed} unchanged, ${failed} failed.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});