# Pre-seen Attachment Fix — "No attached document yet" on the live portal

This document covers the second, separate cause of

> Pre-seen · AFT illustrative brief
> No attached document yet.

after the first fix (`PDF-attachment-fix.md`, commit `02db57d`) was already
released. The first bug (rows deleted on edit) is fixed and confirmed working —
the remaining cause is a **data association problem**, not a code deletion bug.

> Note: `Pre-seen · AFT illustrative brief` is a **hardcoded modal title** in
> `client/src/pages/Home.tsx`. It is not the exam title and tells you nothing
> about which product you are looking at.

## 1. Root cause

There are **two duplicate products** with the same title:

| Product ID | Title            | Status    |
|---|---|---|
| 16         | PDF Pass Test    | published |
| 17         | PDF Pass Test    | draft |

The admin uploaded the pre-seen PDF onto the **draft duplicate** (product 17),
which is exactly how the exam editor works — attachments go to the product the
exam belongs to. The learner portal only shows the **published** product (16),
and `listProtectedResources()` in `server/db.ts` returns resources only for the
requested `productId` **and** with `status = 'published'`:

```ts
// server/db.ts — listProtectedResources
rows = SELECT * FROM resources WHERE productId = :productId AND status = 'published'
```

So:

- Product 16 (published) → has a printable exam but **no pre-seen**.
- Product 17 (draft) → has the pre-seen + printable exam, but is hidden.

When the learner opens the published exam, there is no published pre-seen row
for product 16 → `No attached document yet.`

Database state observed on EC2:

```
Resource ID  Title                       Product  Product status
36           PDF Pass Test · Pre-seen    17       draft
31           PDF Pass Test · Printable   16       published
37           PDF Pass Test · Printable   17       draft
```

The presence of resource 36 (with a valid `fileKey` / `fileUrl`) is also proof
that the earlier `replaceResource()` fix (commit `02db57d`) is live — the PDF
now persists. The user just uploaded it onto the draft duplicate.

## 2. Fix (one-time DB change on EC2)

Run as `root` or the `aftportal` DB user:

```sql
-- 0. Inspect first: every "PDF Pass Test" product and its resources.
SELECT p.id AS product_id, p.title, p.status AS product_status,
       r.id AS resource_id, r.title AS resource_title, r.kind, r.status AS resource_status
FROM products p
LEFT JOIN resources r ON r.productId = p.id
WHERE p.title LIKE '%PDF Pass Test%'
ORDER BY p.id, r.id;

-- 1. Move the pre-seen resource from the draft duplicate (17) onto the
--    published product (16). Guarded: does nothing if a pre-seen already
--    exists on product 16. Idempotent.
UPDATE resources
SET productId = 16
WHERE id = 36
  AND kind = 'pre_seen'
  AND NOT EXISTS (SELECT 1 FROM resources r2 WHERE r2.productId = 16 AND r2.kind = 'pre_seen');

-- 2. Confirm the pre-seen now lives on the published product.
SELECT p.id AS product_id, p.title, p.status AS product_status,
       r.id AS resource_id, r.title, r.status AS resource_status, LEFT(r.fileKey, 60) AS file
FROM products p
JOIN resources r ON r.productId = p.id
WHERE r.kind = 'pre_seen'
ORDER BY p.id;
```

Optional sweep — if other duplicate product titles have pre-seen resources stuck
on non-published duplicates, run this generic re-link (published product must not
already have a pre-seen):

```sql
DELIMITER //
CREATE PROCEDURE aft_fix_pre_seen_links()
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE rid INT;
  DECLARE dst_pid INT;
  DECLARE cur CURSOR FOR
    SELECT r.id,
           (SELECT p2.id FROM products p2
             WHERE p2.title = p1.title AND p2.status = 'published' AND p2.id <> r.productId
             LIMIT 1)
    FROM resources r JOIN products p1 ON p1.id = r.productId
    WHERE r.kind = 'pre_seen' AND p1.status <> 'published'
      AND EXISTS (SELECT 1 FROM products p2
                   WHERE p2.title = p1.title AND p2.status = 'published' AND p2.id <> r.productId);
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO rid, dst_pid;
    IF done = 1 THEN LEAVE read_loop; END IF;
    IF dst_pid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM resources WHERE productId = dst_pid AND kind = 'pre_seen') THEN
      UPDATE resources SET productId = dst_pid WHERE id = rid;
    END IF;
  END LOOP;
  CLOSE cur;
END//
DELIMITER ;

CALL aft_fix_pre_seen_links();
DROP PROCEDURE aft_fix_pre_seen_links;
```

No schema change, no app restart needed for this part.

## 3. Why product 17 exists and what stays in place

Product 17 is almost certainly a duplicate created manually via the admin
"Create draft product / Create exam record" controls (no code path creates a
product when editing an exam — `updateExamBundle` always writes to the exam's
own product). In this incident the draft duplicate was mistaken for the live
exam.

We deliberately do **not** publish product 17 / archive product 16: learners,
entitlements and attempts are tied to the published product 16, so the
non-destructive re-link (Option A) is the safe choice. Product 17 is left
untouched; if no one is using it, it can be archived later.

## 4. Code changes to prevent recurrence (this commit)

| File | Change |
|---|---|
| `client/src/components/ExamStudio.tsx` | Editing an exam whose linked product is **not published** now shows a warning banner: status, product title, and a note that attachments are hidden from learners until published. Prevents silently uploading content to a draft duplicate. |
| `server/db.ts` | `listAdminContent()` for `mock_exams` now also returns `productId`, `productTitle`, `productStatus` (left-joined against `products`). |
| `client/src/pages/AdminConsole.tsx` | The **Catalogue** rows now show the linked product title + status under each exam, so duplicate titles (one published, one draft) are clearly distinguishable before pressing Edit/Publish. |

These are UI/data-shape guards only — they need the normal release pipeline
(`git pull`, `pnpm build`, `systemctl restart aft-portal`).

## 5. Release on EC2

```bash
cd /opt/aft-learning-portal
git pull
pnpm install --frozen-lockfile=false
pnpm build
sudo systemctl restart aft-portal
sudo journalctl -u aft-portal -n 50 --no-pager   # confirm healthy
```

## 6. Verify

1. Learner side: open the published *PDF Pass Test* exam → **Pre-seen** now shows
   the PDF instead of `No attached document yet.`
2. Admin side: open **Catalogue** → both `PDF Pass Test` rows now show
   `Product: PDF Pass Test · published / draft`; edit the **published** one and
   re-upload the pre-seen if desired.
3. Open the draft exam in ExamStudio → the amber "not published — hidden from
   learners" banner is visible.

## 7. Prevent recurrence

- Always edit **the published** copy of an exam from the Catalogue. The new
  product-status line and the ExamStudio banner make that obvious.
- Do not create duplicate products with the same title for the same exam. If a
  duplicate already exists, archive it.
- Publishing an exam / product already mirrors status to its resources
  (`updateAdminContentStatus`, `updateProductStatus`), so a resource properly
  attached to a published exam is immediately visible to learners.