# Running SQL Tool — EC2 Database

This document explains how to connect to the EC2 database and run SQL queries to fix data issues.

> **Note on the database engine:** the deployed app connects to **MySQL** (`DATABASE_URL` /
> `drizzle-orm/mysql2` in `server/db.ts`, not SQLite). The SQL statements in this document are
> standard SQL and run unchanged in either engine, but the shell steps below that mention
> `sqlite3` / `data.db` are illustrative — use the MySQL client (`mysql`, or a migration/seed
> runner via `DATABASE_URL=mysql://...`) according to whatever is actually installed on the EC2
> instance, and adapt the engine-specific exit command.

---

## Prerequisites

- SSH access to the EC2 instance
- The EC2 instance must be running
- You need the SSH key file (e.g. `~/.ssh/id_ed25519`)

---

## Step 1 — SSH into EC2

```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@16.28.52.213
```

If using a different key or IP, adjust accordingly.

---

## Step 2 — Find the database file

The app uses SQLite. The database file is inside the application directory:

```bash
ls /opt/aft-learning-portal/*.db
```

Common filenames: `data.db`, `app.db`, or similar.

---

## Step 3 — Open the SQLite shell

```bash
cd /opt/aft-learning-portal
sqlite3 data.db
```

Replace `data.db` with the actual filename from Step 2.

---

## Step 4 — Run the SQL

Once inside the SQLite shell (you will see `sqlite>` prompt):

### Fix the pre-seen / resource attachment issue

```sql
-- Move all resources from draft product (17) to published product (16)
UPDATE resources SET productId = 16 WHERE productId = 17;

-- Ensure all those resources are published
UPDATE resources SET status = 'published' WHERE productId = 16 AND status = 'draft';

-- Verify the fix
SELECT id, title, kind, status, productId FROM resources WHERE productId = 16;
```

Expected output should show all resources (pre_seen, email, reference, formulae, printable_pdf, feedback) with `status = published` and `productId = 16`.

### Clean up the draft duplicate (run only after confirming the above works)

```sql
-- Remove the draft mock exam linked to product 17
DELETE FROM mock_exams WHERE productId = 17;

-- Remove the draft duplicate product
DELETE FROM products WHERE id = 17;
```

---

## Step 5 — Exit SQLite

```sql
.quit
```

---

## Step 6 — Restart the app (if needed)

```bash
sudo systemctl restart aft-portal
```

This is usually not required for data-only changes, but can help if the app caches results.

---

## Step 7 — Verify on the student portal

1. Open the student portal at `https://16.28.52.213`
2. Navigate to the exam ("PDF Pass Test")
3. Click the **Pre-seen** button in the utility rail
4. The PDF should now appear instead of "No attached document yet."

---

## Useful diagnostic queries

Run these in the SQLite shell to inspect the current state:

```sql
-- List all products
SELECT id, title, status, category FROM products;

-- List all mock exams and their linked products
SELECT m.id, m.title, m.status, m.productId, p.title AS productTitle, p.status AS productStatus
FROM mock_exams m
INNER JOIN products p ON m.productId = p.id;

-- List all resources with their product info
SELECT r.id, r.title, r.kind, r.status, r.productId, p.title AS productTitle
FROM resources r
INNER JOIN products p ON r.productId = p.id
ORDER BY r.id;

-- Find duplicate products with the same title
SELECT title, COUNT(*) AS count FROM products GROUP BY title HAVING count > 1;

-- Find resources on draft products (should not exist for published exams)
SELECT r.id, r.title, r.kind, r.status, p.title AS productTitle, p.status AS productStatus
FROM resources r
INNER JOIN products p ON r.productId = p.id
WHERE p.status = 'draft';

-- Verify a case-study exam exposes exactly 4 sections (the new multi-task flow renders one task per section)
SELECT m.id AS mockExamId, m.title, m.status AS examStatus,
       s.sectionNumber, s.title AS sectionTitle,
       s.durationSeconds, s.cooldownSeconds
FROM mockExams m
INNER JOIN caseStudySections s ON s.mockExamId = m.id
WHERE m.status = 'published'
ORDER BY m.id, s.sectionNumber;

-- Count published sections per published mock exam (update the runbook tip: sections are published via their parent mock_exam status)
SELECT m.id AS mockExamId, m.title, COUNT(s.id) AS exposedSectionCount,
       MAX(s.sectionNumber) AS maxSectionNumber, MIN(s.sectionNumber) AS minSectionNumber,
       SUM(s.durationSeconds) AS totalTaskSeconds
FROM mockExams m
LEFT JOIN caseStudySections s ON s.mockExamId = m.id
WHERE m.status = 'published'
GROUP BY m.id, m.title
ORDER BY m.id;
```

If a published exam exposes fewer (or more) than 4 sections, add/remove the section rows so `sectionNumber` runs 1–4; each task's own 45-minute clock comes from its section's `durationSeconds` (default 2700).

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `sqlite3: command not found` | Install it: `sudo apt install sqlite3` |
| `database is locked` | Stop the app first: `sudo systemctl stop aft-portal`, run SQL, then restart |
| Wrong database file | Check `ls *.db` in the app directory, or check the app config |
| SSH connection refused | Check the EC2 security group allows SSH (port 22) from your IP |
| Resources still not showing | Verify `productId` matches between the exam and its resources (see diagnostic queries above) |
