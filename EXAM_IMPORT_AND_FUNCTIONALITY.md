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

### 4.3 Case-study flow

- A learner starts a case study, works through its **4 sections**, and can save
  an attempt and resume it later.
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

---

## 5. Deploying exams to a new EC2 instance — checklist

After the app and database are running (see `EC2_DEPLOYMENT.md`):

```bash
cd /opt/aft-learning-portal
git pull                      # get the latest catalogue SQL + source-pdfs
pnpm install --frozen-lockfile=false
pnpm exec drizzle-kit migrate # schema only (does NOT import exams)
pnpm build
# ensure DATABASE_URL and S3 vars are in .env, then:
pnpm exec tsx server/scripts/seed-exams.ts   # load exams + attach PDFs
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

---

## 7. Keeping exams up to date

Because the imports are idempotent, the routine to ship updated exam content is:

1. Replace the files in `source-pdfs/` (or edit the SQL catalogue).
2. Commit and push to GitHub (`master -> main`).
3. On EC2: `git pull`, then re-run `pnpm exec tsx server/scripts/seed-exams.ts`
   and restart the service.

No destructive migration is involved — re-running simply refreshes rows and
re-attaches PDFs.

---

*Command reference: `pnpm check` (typecheck) and `pnpm test` (38 tests) are the
verification gates before pushing changes to the exam/import code.*
