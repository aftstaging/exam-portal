# Exam Module Change — Per-Task Email & Reference Attachments

**Date:** 23 September 2026
**Repository:** https://github.com/aftstaging/exam-portal

This document explains how to bring the per-task email attachment and per-task
reference material feature to life in a deployed environment (local dev, staging,
or the EC2 production server). It covers what changed, the schema migration,
deployment steps, verification, and rollback.

---

## 1. What changed

Previously a case-study exam had exactly **one** exam-wide email attachment and
**one** exam-wide reference document that the learner could open on any task.

Now each case-study **task (section)** can carry its own email attachment and its
own reference document. The learner sees the email/reference that belongs to the
task they are currently on. Pre-seen material and formulae + tables remain
exam-wide (universal).

### Behaviour summary

| Resource | Scope | Learner behaviour |
|----------|-------|-------------------|
| Pre-seen material | Universal (exam-wide) | Same on every task |
| Formulae + tables | Universal (exam-wide) | Same on every task |
| Email attachment | Per task | Shows the email for the current task; falls back to the old exam-wide email if a task has none |
| Reference material | Per task | Same per-task resolution as email |
| Feedback | Universal | Unchanged |
| Printable exam PDF | Per task | PDF prints each task's email + attachment titles inside that task's section |

### What was added/updated

- **Schema/migration:** `resources.sectionNumber int` (nullable). `NULL` = universal
  (pre-seen, formulae, legacy fallback rows); a number = belongs to task N.
- **`server/db.ts`:** new `writeSectionResources()` helper for create/update
  email-and-reference rows (email meta JSON, email image, reference doc,
  upload/keep/delete, audit events); per-task aggregation in `createExamBundle`,
  `updateExamBundle`, `getAdminExamBundleDetail`, `getAdminExamPreview`,
  `generatePrintablePdf`, and protected-resource download/zip endpoints.
- **`server/pdf.ts`:** prints each task's email (from/to/subject/body) and its
  attachment titles under the task section.
- **`server/routers.ts`:** zod input for `createExamBundle` / `updateExamBundle`
  now accepts per-section `emailFrom/To/Subject/Text`, `emailImage`, `reference`
  (update also accepts `keepUrl` for unchanged files).
- **`client/src/components/ExamStudio.tsx`:** per-task email editor (from/to/
  subject/message + optional email image + clear button) and per-task reference
  slot inside each section editor; preview modal shows per-task email and badges;
  detail-load migrates a legacy exam-wide email into Task 1.
- **`client/src/pages/Home.tsx`:** learner buttons are labelled
  "Email attachment · Task N" / "Reference material · Task N" and resolve the
  resource for the current task, falling back to exam-wide rows for older exams.
- **`client/src/pages/AdminConsole.tsx`:** admin preview renders each task's email
  and badges for email image / reference file name.

### Backward compatibility

- Old exams that only have a universal email/reference row keep working: the
  learner viewer falls back to `sectionNumber = NULL` rows.
- Re-saving an old exam in the studio migrates the universal email meta into
  Task 1 so authors can start per-task editing.
- Universal rows are **never** deleted on re-save; the feature is purely additive.

---

## 2. Database migration

Generated migration (already committed in this change):

**File:** `drizzle/0013_normal_roulette.sql`

```sql
ALTER TABLE `resources` ADD `sectionNumber` int;
```

`sectionNumber` is nullable, so the migration is safe on existing data — it only
adds a column and requires no back-fill. Resources with `NULL` continue to behave
as before (universal attachments).

---

## 3. Local development

```bash
# 1. Install dependencies
pnpm install

# 2. Apply the schema migration
pnpm run db:push

# 3. Start the dev server
pnpm dev
```

### Local verification (recommended)

```bash
# Type-check
pnpm check

# Run the test suite (56 tests incl. PDF + import suites)
pnpm test

# Optional: confirm drizzle produces no further migration beyond 0013
pnpm exec drizzle-kit generate
# Expect: "No schema changes, nothing to migrate"
```

Manual smoke test:

1. Create a case-study exam in Exam Studio with 2+ tasks.
2. Give Task 1 and Task 2 different email attachments and different reference documents.
3. Save / publish, then open the exam as a learner.
4. On Task 1 confirm the buttons read "Email attachment · Task 1" / "Reference material · Task 1" and show Task 1's content; on Task 2 confirm Task 2's content.
5. As an admin, open the exam preview and confirm each task's email shows under its section with the email-image/reference badges.
6. Download the printable exam PDF and confirm each task section includes its email and attachment list.

---

## 4. Deploying to the EC2 server

Run these on the server:

```bash
cd /opt/aft-learning-portal

# 1. Pull the latest code
git pull origin main

# 2. Install dependencies
pnpm install

# 3. Apply the schema migration (adds resources.sectionNumber)
pnpm run db:push

# 4. Build the frontend and server bundles
pnpm run build

# 5. Restart the service
sudo systemctl restart aft-portal
```

### Verify it is live

```bash
sudo systemctl status aft-portal
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/   # expect 200
sudo journalctl -u aft-portal --no-pager -n 30
```

Then repeat the manual smoke test above against the deployed site (create a
case-study exam, give two tasks different emails, verify as learner + admin,
download the printable PDF).

> On `databaseVersionId`-style setups (none here), no extra flag is needed — the
> migration is applied automatically by `drizzle-kit migrate`.

---

## 5. How to author per-task attachments (after deploy)

1. Open Exam Studio → Case study exam → create a section (task).
2. Under the **Task email** editor set From / To / Subject and the message body.
   Optionally attach one **email image**.
3. Attach the per-task **reference** document in the section's reference slot.
4. Leave a task's email/reference empty if that task should use none (or, for
   legacy exams, the migrated Task 1 email).
5. Save/publish. Pre-seen and formulae remain configured at exam level.

---

## 6. Rollback plan

### Code rollback

```bash
git log --oneline -5          # find the commit before this change
git checkout <previous-commit> -- .
pnpm install
pnpm run build
sudo systemctl restart aft-portal
```

### Database rollback

The column is only ever read by new code, so reverting code alone is harmless.
To physically drop the column if desired:

```sql
ALTER TABLE `resources` DROP COLUMN `sectionNumber`;
```

Note: after dropping, any per-task rows written by the new feature would lose
their task binding — full rollback of data written by this feature requires
reverting those rows as well, which is outside normal scope.

---

## 7. Files in this change

| File | Purpose |
|------|---------|
| `drizzle/schema.ts` | Added `sectionNumber int` on `resources` |
| `drizzle/0013_normal_roulette.sql` | Migration: `ALTER TABLE resources ADD sectionNumber int` |
| `drizzle/meta/0013_snapshot.json`, `drizzle/meta/_journal.json` | Drizzle migration metadata |
| `server/db.ts` | `writeSectionResources`, per-task aggregation in create/update/details/PDF/protected resources |
| `server/pdf.ts` | Per-task email + attachment titles in the printable PDF |
| `server/routers.ts` | Per-section email/reference input schemas (with `keepUrl`) |
| `client/src/components/ExamStudio.tsx` | Per-task email/reference editors, preview, detail-load migration |
| `client/src/pages/Home.tsx` | Per-task resolution + task-labelled resource buttons |
| `client/src/pages/AdminConsole.tsx` | Per-task email in admin exam preview |