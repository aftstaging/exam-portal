# PDF Attachment Fix — Deploy Runbook

This document describes the bug fix for pre-seen / resource PDF attachments
disappearing when an exam is edited from the catalogue, and the exact steps to
pull the update to the EC2 server and release it.

## 1. What was wrong

When a staff member uploaded a PDF (pre-seen, formulae, reference, or a
pre-moderated/printable paper) onto an exam and saved it **while editing an
existing exam**, the resource was deleted immediately in the same save.

- Students saw `No attached document yet.` when opening the exam.
- Re-opening the editor in the catalogue showed the previously attached PDF
  was gone.

Root cause: in `server/db.ts`, `updateExamBundle` → `replaceResource()`
uploaded the new file and inserted the new `resources` row, **then** deleted
every resource row of that kind for the product — including the row it had just
inserted. Only those resources attached at *creation* time were unaffected; any
PDF attached during an *edit/save* was removed in the same transaction.

## 2. What changed

| File | Change |
|---|---|
| `server/db.ts` | `replaceResource()` now deletes only the **previous** rows of that kind and keeps the row it just inserted (matched by its `fileUrl`). Indexes as `not(eq(resources.fileUrl, url))`. |
| `client/src/components/ExamStudio.tsx` | The editor only shows a file as attached when the resource actually has a stored `fileUrl`, so the form no longer masks a missing file. |

No database schema change was required. This is a code-only fix.

- Commit: `02db57d` — "Fix pre-seen PDF attachment disappearing when editing exams from catalogue"
- Branch: `main`

## 3. Pull the update to EC2

SSH into the server, then run the normal release pipeline:

```bash
cd /opt/aft-learning-portal

# 1. Pull the latest code from GitHub
git pull

# 2. Install any dependency changes (none for this fix, safe to run anyway)
pnpm install --frozen-lockfile=false

# 3. Migrations — NOT required for this fix (no schema change). Skip if you
#    have already migrated; run only if you also changed the schema:
# export DATABASE_URL="mysql://aftportal:PASSWORD@localhost:3306/aft_portal"
# pnpm exec drizzle-kit migrate

# 4. Build the production bundle (client + server)
pnpm build

# 5. Restart the app service
sudo systemctl restart aft-portal
```

Verify the app is healthy:

```bash
sudo systemctl status aft-portal
sudo journalctl -u aft-portal -n 50 --no-pager
```

If the nginx config changed you may also need:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 4. Once deployed — restore exams broken by the old bug

The old bug deleted the resource database rows it had just created. Those exams
have already lost their attachment, so the PDF must be uploaded once more:

1. Open the exam in the admin **Catalogue** → **Edit**.
2. In **Case study resources**, choose the PDF again (or re-upload it) for the
   relevant slot (Pre-seen, Formulae + tables, Reference material, or the
   pre-moderated paper).
3. **Save changes**.
4. Verify as a learner: open the exam → the attachment now renders / downloads
   instead of `No attached document yet.`.

From now on, re-saving an edited exam keeps the attached PDF, and students will
see it.

## 5. Verify the fix

- Upload a PDF on an existing exam via catalogue → Edit → Save.
- Open the same exam as a student → the PDF is shown/attached.
- Open catalogue → Edit again → the previously uploaded PDF is still selected.