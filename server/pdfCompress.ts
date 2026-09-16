// Compress PDFs with Ghostscript (gs) so protected attachments (question papers,
// pre-seen briefs, reference material) open much faster in the in-app viewer.
// Falls back to the original bytes when gs is not installed or fails, so an
// uncompressed PDF is never destroyed.

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function compressPdfSource(input: Buffer): Promise<Buffer> {
  if (!input || input.length < 64) return input;
  const dir = await mkdtemp(join(tmpdir(), "aft-pdf-"));
  const inPath = join(dir, `${randomUUID()}.pdf`);
  const outPath = join(dir, `${randomUUID()}.pdf`);
  try {
    await writeFile(inPath, input);
    await execFileAsync(
      "gs",
      [
        "-sDEVICE=pdfwrite",
        "-dPDFSETTINGS=/ebook",
        "-dCompatibilityLevel=1.4",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        "-dDetectDuplicateImages=true",
        `-sOutputFile=${outPath}`,
        inPath,
      ],
      { timeout: 120_000, maxBuffer: 64 * 1024 * 1024, windowsHide: true },
    );
    const compressed = await readFile(outPath);
    if (compressed.length > 0 && compressed.length < input.length) return compressed;
    return input;
  } catch {
    return input;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}