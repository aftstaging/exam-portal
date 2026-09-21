# Exam Import & Functionality

This document explains **how exams are loaded into the portal** and **how each
part of the exam system works**, both for developers maintaining the codebase
and for operators running a self-hosted deployment on EC2.

---

## 1. The two layers of every exam

Every exam in the portal is composed of two independent layers that must both
be in place for learners to use it:

| Layer | What it is | Where it lives | How it gets there |
|---|---|---|---|
| **Catalogue metadata** | Product, mock exam, sections, questions, resources | MySQL through Drizzle | The SQL import files |
| **Source files** | The branded printable PDFs (question papers, marking guides) | AWS S3 | The seed script uploads `source-pdfs/` and attaches them |

A freshly deployed portal has the database schema but **none** of this data,
which is why it shows no exams. Both layers must be loaded explicitly.

---

## 2. Exam types

The portal ships two types of exam, each with its own catalogue importer.

### 2.1 Case-study (mock) exams — `drizzle/import-sample-exams.sql`

- 3 products (CIMA Operational/Performance/Strategic case studies).
- Each product has a **mock exam** made of **4 case-study sections**.
- Each section references a **protected resource** (question paper / marking
  guide) that learners download after enrolling.
- Imported resources are created with `fileKey`/`fileUrl` = `NULL`: the full
  text is never stored in MySQL, the PDF is the source of truth and is attached
  from S3 by the seed script.

Products / resources produced:

| Product | Section | Resource title |
|---|---|---|
| Cartn Case Study Mock 3 | 4 sections | Cartn Mock Exam 3 — Question paper / Suggested solutions |
| Cartn Case Study Mock 4 | 4 sections | Cartn Mock Exam 4 — Question paper / Suggested solutions |
| Mock B | 4 sections | Mock B — May & August 2026 question paper / Answers and marking guide |

### 2.2 Objective-test exams — `drizzle/import-objective-tests.sql`

- 3 products (CIMA Study-inspired Objective practice tests).
- Each product has a **mock exam** backed by a **question bank** of
  multiple-choice questions with explanations.
- These are entirely data-driven (typed questions stored in MySQL), so they
  need **no PDF files**.

---

## 3. How the exams get imported — `server/scripts/seed-exams.ts`

There is a single, repeatable, **idempotent** command that loads both layers:

```bash
cd /opt/aft-learning-portal
pnpm exec tsx server/scripts/seed-exams.ts
```

What it does, in order:

1. **Imports the case-study catalogue** by running
   `drizzle/import-sample-exams.sql`.
2. **Imports the objective-test catalogue** by running
   `drizzle/import-objective-tests.sql`.
3. **Uploads the source PDFs** from `source-pdfs/` to S3 and updates the
   matching `resources` rows (`fileKey`/`fileUrl`).

The script connects directly to MySQL via `DATABASE_URL` (with
`multipleStatements` enabled) and to S3 via the storage layer
(`server/storage.ts`).

### Idempotency — safe to re-run

- Every SQL `INSERT` is guarded by `WHERE NOT EXISTS`.
- Every PDF attach **replaces** the existing file key on the matched row.

So re-running the script after a `git pull` with updated PDFs refreshes the
files without duplicating rows. It is safe to run any number of times.

### Environment required

The script reads from `.env`:

- `DATABASE_URL` — MySQL URI (must point at the existing portal database).
- S3 credentials — `AWS_REGION` + `S3_BUCKET`, plus either an IAM role or
  `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.

### Source-PDF → resource mapping

The script maps each imported resource (matched by exact title) to a local PDF:

| Resource title (in `resources` table) | Source file (in `source-pdfs/`) |
|---|---|
| Cartn Mock Exam 3 — Question paper | `cartn-mock-3-questions.pdf` |
| Cartn Mock Exam 3 — Suggested solutions | `cartn-mock-3-solutions.pdf` |
| Cartn Mock Exam 4 — Question paper | `cartn-mock-4-questions.pdf` |
| Cartn Mock Exam 4 — Suggested solutions | `cartn-mock-4-solutions.pdf` |
| Mock B — May & August 2026 question paper | `cima-mock-b-questions.pdf` |
| Mock B — Answers and marking guide | `cima-mock-b-answers-marking-guide.pdf` |

If a source PDF is missing or a resource title is renamed, the script logs a
warning and continues, so a partial import never blocks the rest.

---

## 4. How exam functionality works in the app

### 4.1 Cataloguing and discovery

- Public routes expose the catalogue (products → mock exams → sections) built
  from the MySQL rows created above.
- Each product carries a `priceCents`; current published seed data uses `0` so
  learners see a **Start exam** / free-enrollment action.

### 4.2 Enrolment and the learner dashboard

- Enrolling links the learner to the product and populates the student
  dashboard with owned products, progress, saved attempts, and **resume**
  actions.

### 4.3 Case-study flow (multi-task)

Since commit `5b86e57` the case-study shell (`ExamShell` in
`client/src/pages/Home.tsx`) runs a **multi-task** flow — one task per
published section:

- **Instructions** list every task (from `caseStudySections`) with its own
  title and time limit (default 45 minutes).
- **Start Task 1** → a per-task **cool-down intro** (`cooldownSeconds`, default
  30s) that auto-starts the task's clock.
- Each **task screen** has its own `durationSeconds` countdown and a fresh
  answer pad; answers are stored per section (`attempts.currentSection`) and
  autosaved while typing.
- **Next task** saves the current answer and moves to the next task's intro
  with a fresh clock. **Review & submit** appears only on the final task.
- If a task's clock **expires**, the answer is saved automatically and the user
  is moved to the next task without it ending the exam; after the final task an
  expiry submits the attempt automatically (`optOutOfMarking: true`).
- If fewer than 4 sections exist the shell still renders 4 placeholder tasks
  (recovery fallback `Math.max(examSections.length || 4, 1)`), with the tip
  "the protected question paper is the source of truth" for section wording.
- Each section's resource (question paper / solutions) is a **protected
  download**: the server issues a short-lived S3 signed URL through the
  `/storage/:key` proxy route (`server/_core/storageProxy.ts`) so the PDF is
  never served publicly.
- Completed attempts are **submitted for instructor marking** (add-on).

### 4.4 Objective-test flow

- A learner starts an objective test, answers the **question bank** MCQs with
  explanations, and gets auto-graded scored feedback.

### 4.5 Instructor / admin consoles

- Instructors review and mark submitted case-study attempts.
- Admins manage products, pricing, resources and content from the admin
  console. Admins can also attach or replace resource files there.

### 4.6 Resource attachments (pre-seen, formulae, reference, PDFs)

Exams can carry protected attachments — a **pre-seen** brief, **formulae +
tables**, **reference material**, a **pre-moderated / printable paper**, an
**email brief**, and **feedback** — attached by admins either at creation or
when editing from the Catalogue (ExamStudio → *Case study resources*).

How attachment resolution works:

- Every resource row belongs to a **product** (`resources.productId`), and is
  uploaded to S3 under `admin-resources/<productId>/`.
- Editing an exam always saves resources against **the product the exam belongs
  to** (`updateExamBundle` in `server/db.ts`).
- The learner portal only ever returns resources for the **published** product
  the learner is viewing (`listProtectedResources`), and only rows with
  `status = 'published'` (`server/db.ts:313`).

Operational consequences:

- A **draft** exam/product is hidden from learners, so anything attached to it
  (including a pre-seen PDF) is invisible until that product is published.
- **Do not create a second product with the same title** for the same exam and
  upload there — learners still load the published product and will report
  "No attached document yet." (That modal title — "Pre-seen · AFT illustrative
  brief" — is hardcoded in `client/src/pages/Home.tsx` and does **not**
  identify which exam is open.)
- Since commit `569082c` the ExamStudio editor warns when the exam being edited
  is **not published** (hidden from learners), and the admin **Catalogue** now
  shows each exam's linked product title + status so duplicate titles are
  obvious before clicking Edit/Publish.
- See `PRESEEN-ATTACHMENT-FIX.md` for the full incident write-up and the
  one-time DB re-link SQL.

### 4.7 Protected downloads — ZIP bundle and the larger PDF viewer

Since commit `5b86e57`:

- **ZIP download-all** (`server/zip.ts` + `getProtectedResourceZip` in
  `server/db.ts`, exposed as `resources.downloadZip`): the "Protected
  downloads" panel in `ProtectedResourceList` (`client/src/pages/Home.tsx`)
  shows one row per resource **kind** (deduplicated, newest first) and a single
  `Download all attachments (ZIP)` button. It verifies product entitlement,
  SKIPS older duplicates per kind, streams each file's bytes from S3
  (`storageGetBytes` in `server/storage.ts`), writes a self-contained ZIP
  (CRC-32 + DEFLATE), uploads it back to S3 under `downloads/<productId>/`, and
  returns a short-lived signed URL the browser downloads under the escaped
  product name. A real ZIP tool is never required.
- **PDF compression** (`server/pdfCompress.ts`): every PDF written to storage
  through `storagePut` (`server/storage.ts`) is run through **Ghostscript**
  (`gs -dPDFSETTINGS=/ebook`) and the compressed copy is stored, so the in-app
  viewer downloads much less data and opens faster. If `gs` is not installed or
  fails, the original bytes are kept unchanged (the upload never breaks).
  To compress PDFs that were stored *before* this change, deploy then run
  `pnpm exec tsx server/scripts/compress-resources.ts` once on EC2 (requires
  `sudo apt install ghostscript`).
- **Larger PDF reader** (`ResourceModal` + `ProtectedResourceView`): both the
  exam utility rail and the exam shell open attachments in a shared popup
  (`max-w-5xl`, `max-h-[88vh]`). PDFs render at
  `#toolbar=0&navpanes=0&zoom=page-width&view=FitH` inside a `h-[70vh]`
  iframe, so the browser's page/thumbnail sidebar is hidden and the paper fills
  the width for continuous reading; images display at `max-h-[70vh]`.
- **One-click Download** (`ProtectedResourceList` in
  `client/src/pages/Home.tsx`): the "Protected downloads" panel is a single
  clean **Download** button (it still produces a ZIP bundle of the product's
  published attachments, deduplicated per kind, but the UI no longer labels
  ZIP / contents / Included).

### 4.8 Import a whole exam from a PDF (ExamStudio)

The **Create / Edit exam** screen (ExamStudio,
`client/src/components/ExamStudio.tsx`) can build an exam straight from a
pre-moderated question paper — no manual data entry or SQL required:

- A new **Import from PDF** panel has two slots:
  - **Question paper (PDF)** — uploaded to `exams.createFromPdf`
    (`server/routers.ts`, a `staffProcedure` mutation backed by
    `server/pdfImport.ts`). The server reads the file with pdfjs-dist and
    returns a structured `PdfExamDraft` that the client applies to the whole
    form (`applyImportedDraft`): title, exam type, total duration, section
    tasks, objective questions, the email brief, and the carved
    **reference** and **formulae + tables** PDFs (both are re-serialised from
    the original file). It never writes to the database — the admin then saves
    the populated form through the normal bundle flow (always a **draft**,
    never auto-published).
  - **Suggested answers / solutions / marking guide (PDF, optional)** — simply
    attached to the exam's **feedback** resource using the existing
    `setFeedbackFile` flow.
- Automatically-detected **suggested-solutions documents** (e.g.
  `cartn-mock-*-solutions.pdf`, `cima-mock-b-answers-marking-guide.pdf`) are
  never parsed for exam content; they are attached as the exam's feedback
  document with an explanatory note shown in the panel.
- Files are sent as a base64 data-URL (`mimeType` checked to be
  `application/pdf`, size limit 28 MB → matches the Express 50 MB body limit);
  the server strips the data-URL prefix via `stripDataUrl` in
  `server/pdfImport.ts`.
- Parsing quirks handled by the parser (see `server/pdfImport.ts`):
  - Kaplan-style running headers are stripped (`MOCK EXAM B`, `KAPLAN
    PUBLISHING`, …) so they never corrupt section content.
  - Each case-study task maps to a section with a 45-minute
    `durationSeconds`, title `Task N — Unseen case material` (Cartn) or
    `Task N` (Mock B), and the full task-page text as its introduction.
  - Reference/formulae pages are located by running header + dropping
    continuation pages, then re-serialised into PDF attachments. Page 1's
    cover title is re-extracted raw (`extractCoverText`) because the running
    header already swallowed "Mock Exam 3"-style text.
- **Learner-shell preview**: the **Preview** button now renders
  `ExamPreviewDraft` inside the same `.exam-shell` (titlebar with title +
  duration, a sessionbar of section chips, `exam-card` content) so admins see
  exactly how learners will experience the exam before saving.
- Coverage is enforced by `server/pdfImport.test.ts` (7 contract tests that
  load the six `source-pdfs/` files through the real
  `exams.createFromPdf` tRPC route with a staff caller).

---

## 5. Deploying exams to a new EC2 instance — checklist

After the app and database are running (see `EC2_DEPLOYMENT.md`):

```bash
cd /opt/aft-learning-portal
git pull                      # get the latest catalogue SQL + source-pdfs
pnpm install --frozen-lockfile=false
pnpm exec drizzle-kit migrate # schema only (does NOT import exams)
sudo apt install -y ghostscript  # needed for the one-time PDF re-compression
pnpm build
# ensure DATABASE_URL and S3 vars are in .env, then:
pnpm exec tsx server/scripts/seed-exams.ts   # load exams + attach PDFs
pnpm exec tsx server/scripts/compress-resources.ts  # shrink already-stored PDFs
sudo systemctl restart aft-portal
```

Sanity checks after the import:

1. **Products** appear on the public catalogue.
2. **Case-study sections** are listed inside each product.
3. **Start exam** works and the dashboard records the enrolment.
4. **PDF download** returns the branded source PDF (not an error).
5. **Objective tests** present their question bank and grade on submit.

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No exams anywhere | `seed-exams.ts` never run | Run it (section 5) |
| Case-study appears but PDF download fails | `resources.fileKey` is `NULL` (PDF not attached) | Re-run `seed-exams.ts` |
| Objective tests missing | `import-objective-tests.sql` not run | Re-run `seed-exams.ts` |
| Script error on S3 put | S3 env missing / no write permission | Set `AWS_REGION`/`S3_BUCKET` and credentials or the IAM S3 role |
| `/storage/...` 502 | Signed URL generation failed | Check S3 access + bucket region |
| Pre-seen shows "No attached document yet." | Pre-seen row is linked to a draft / duplicate product, or resource `status` is not `published` | Run the re-link SQL in `PRESEEN-ATTACHMENT-FIX.md` §2; then re-upload via the **published** exam's Edit |
| Attachments "disappear" when re-editing an exam | Old `replaceResource()` bug on pre-fix builds | Deploy commit `02db57d` (`PDF-attachment-fix.md`), then re-upload the PDF once via Catalogue → Edit |
| Exam shows the wrong number of tasks / sections | Published `caseStudySections` rows don't run 1–4 | Deploy commit `5b86e57` (multi-task `ExamShell`) and verify with the section-count queries in `RUNNING-SQL-TOOL.md`; add/remove section rows so `sectionNumber` runs 1–4 |
| PDF opens as two panes / at page-thumbnail zoom | Old viewer with sidebar + single-page zoom | Deploy commit `5b86e57` (`#navpanes=0&zoom=page-width` in `ProtectedResourceView`) |
| PDFs open slowly in the viewer | Stored PDFs are uncompressed, or `gs` is missing | Deploy the compression change, `sudo apt install ghostscript`, then run `seed-exams.ts` and `compress-resources.ts` (§5) |

---

## 7. Keeping exams up to date

Because the imports are idempotent, the routine to ship updated exam content is:

1. Replace the files in `source-pdfs/` (or edit the SQL catalogue).
2. Commit and push to GitHub (`master -> main`).
3. On EC2: `git pull`, then re-run `pnpm exec tsx server/scripts/seed-exams.ts`
   and restart the service.

No destructive migration is involved — re-running simply refreshes rows and
re-attaches PDFs.

> Gotcha: resources follow the exam's **product**, not the exam title. If the
> same exam title exists twice (e.g. a published product and a draft
> duplicate), attachments land on whichever product you edited — the other copy
> will not show them. Prefer a single product per exam, and edit the published
> copy.

---

*Command reference: `pnpm check` (typecheck) and `pnpm test` (47 tests) are the
verification gates before pushing changes to the exam/import code.*
