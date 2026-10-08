# Combined Portal Updates — local work → EC2

**Targets**

| Site | URL | Stack | Repository |
|---|---|---|---|
| Main site (WordPress) | http://16.28.52.213/ | WordPress + Tutor LMS on Apache/PHP + MySQL | https://github.com/aftstaging/wordpress |
| Exam portal | http://16.28.52.213/exam | Node.js + Vite build + MySQL, systemd `aft-portal` | https://github.com/aftstaging/exam-portal |

**How to read this document.** Every improvement is built and verified on the local
machine first, committed, pushed to GitHub, and *then* pulled onto EC2. Nothing is
edited directly on the server. Keep the "Change log" at the bottom of this file
up to date: every change gets a row before it is pulled to EC2.

---

## 0. For the operator — start here

**Everything you need is already on GitHub.** You do not need access to anybody's
local machine, no zip files, no copying code by hand. SSH to the server, pull, done.

| You need | Get it from |
|---|---|
| This document + portal code (client, server, migrations, scripts) | https://github.com/aftstaging/exam-portal — branch `main` |
| WordPress custom code (theme, MU-plugins, `aft-portal-auth`, `deploy/ec2-pull-update.sh`) | https://github.com/aftstaging/wordpress — branch `main` |

**What lives only on the server (never in Git, never overwritten by a pull):**
WordPress `wp-config.php` + uploads + vendor plugins, the portal `.env`
(including the **AWS/S3 credentials — S3 is already set up on EC2**, so profile
pictures and resource uploads work there), both databases — which already
contain all students, exams and attempts and are only ever *modified in place,
never dropped or re-imported* (§7) — and nginx/systemd/TLS config. See §11 for
the full list.

**Your routine, in one line per site:**

```bash
# WordPress site — http://16.28.52.213/
ssh -i ~/.ssh/id_ed25519 ubuntu@16.28.52.213
cd /var/www/html && bash deploy/ec2-pull-update.sh

# Exam portal — http://16.28.52.213/exam
cd /opt/aft-learning-portal && \
  mysqldump -u aftportal -p aft_portal > /tmp/aft_portal_$(date +%F_%H%M).sql && \
  git pull --ff-only origin main && pnpm install && pnpm build && \
  sudo systemctl restart aft-portal
```

Then run the verification checklist in §10.

**Before you pull anything the first time**, read §4 (how to see what is coming)
and §5.0/§6.0 (preflight). **If something goes wrong**, §8 has the fix for each
common failure, §9 is the rollback. Never force, never edit files on the server,
never `git commit` on the server (§1 rules 7–8).

**Order when both repos changed:** WordPress first (so the verify endpoint already
exists), verify it answers, then the portal (it needs the endpoint for WP login).

---

## Contents

0. **For the operator — start here (everything is on GitHub)**
1. Golden rules (never break what is already on EC2)
2. Where things live
3. **How to pull changes properly — the 6-step ritual**
4. **Pre-pull: review exactly what is coming**
5. Update WordPress on EC2 — full instructions
6. Update the exam portal on EC2 — full instructions
7. **Database updates — change the structure, never the data**
8. When a pull does not go smoothly (troubleshooting)
9. Rollback
10. Post-deploy verification checklist
11. What must never be touched by an update
12. Credentials used for verification
13. Status of the current work stream
14. Change log

---

## 1. Golden rules (never break what is already on EC2)

1. **Update in place, never re-clone, never wipe.** Both updates are
   `git pull --ff-only`. A fast-forward cannot rewrite history or delete files.
2. **The pull never deletes untracked files.** All real data on EC2 lives in
   paths Git does not track (see §11). This is what makes the update safe.
3. **No secrets in Git.** `.env`, `wp-config.php`, `*.pem` and vendor packages are
   ignored by `.gitignore`. New secrets are typed onto the server by hand, once.
4. **Back up the database before anything that runs a migration** (§6.1, full
   database rules in §7).
5. **Migrations are additive only** — new tables/columns. No `DROP`, no
   `TRUNCATE`, no data rewrites in a release: **EC2 already has live databases
   and an update must only modify/extend them, never remove them** (§7).
6. **Verify after every pull** with the checklist in §10, on both URLs.
7. **One change at a time.** Pull the WordPress repo and the portal repo as two
   separate steps, verifying between them (§3.6).
8. **Never `git add`, `git commit`, `git checkout <file>` or `git stash` on the
   server.** The server only ever *receives* commits made locally. The only git
   commands used on EC2 are `fetch`, `pull --ff-only`, `log`, `diff`, `status`,
   and — for rollback only — `reset --hard <commit>`.

---

## 2. Where things live

| | Local machine | EC2 |
|---|---|---|
| Portal repo | `aft-learning-portal/` (branch `main`) | `/opt/aft-learning-portal` |
| Portal runtime | `pnpm dev` or Docker (`docker-compose.local.yml`) | systemd unit **`aft-portal`** (`node dist/index.js`, port 3000) |
| Portal DB | local MySQL `aft_portal` (or Docker DB) | local MySQL `aft_portal` |
| WordPress repo | `aft-learning-portal/Wordpress/` (branch `main`) | `/var/www/html` (WordPress document root) |
| WordPress data | Docker volume `wp_data` | `/var/www/html/wp-content/uploads`, `wp-config.php` |

SSH (from `RUNNING-SQL-TOOL.md`):

```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@16.28.52.213
```

**Health/preflight — run this before any update session:**

```bash
ls -d /opt/aft-learning-portal /var/www/html                    # both paths exist
cd /var/www/html && git remote -v            # expect github.com/aftstaging/wordpress
cd /opt/aft-learning-portal && git remote -v # expect github.com/aftstaging/exam-portal
git ls-remote --heads origin >/dev/null && echo "GitHub auth OK"   # non-interactive pull works
systemctl is-active aft-portal nginx                            # both "active"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/ # 200 (portal)
df -h / && free -m                                              # disk + RAM headroom
```

`GitHub auth OK` must print **without asking for a username/password**. If it
hangs on credentials, the server has no way to read the (private) repositories —
fix that before pulling: either the clone was made over SSH with a key
(`git remote -v` shows `git@github.com:…`) or it needs a fine-grained personal
access token stored for the user that runs the pull:

```bash
# HTTPS remotes: store a token once (repo contents:read)
git config --global credential.helper store
git pull --ff-only origin main      # enter username + token the first time
```

If neither repository is on the server yet (fresh machine only — never do this on
a server that already has content):

```bash
git clone https://github.com/aftstaging/wordpress.git /var/www/html          # WordPress
git clone https://github.com/aftstaging/exam-portal.git /opt/aft-learning-portal
```

If any preflight line disagrees with the expectation, stop and re-read §5/§6
against reality before touching anything.

---

## 3. How to pull changes properly — the 6-step ritual

Every release, for **each** repository, in this order:

| Step | WordPress (`/var/www/html`) | Portal (`/opt/aft-learning-portal`) |
|---|---|---|
| 1. **Fetch** | `git fetch origin` | `git fetch origin` |
| 2. **Review** | `git log --oneline HEAD..origin/main` | `git log --oneline HEAD..origin/main` |
| 3. **Backup** | (a WordPress pull never changes the DB — §7.7) | `mysqldump … > /tmp/aft_portal_$(date +%F_%H%M).sql` + table inventory (§7.4, §7.6) |
| 4. **Pull** | `git pull --ff-only origin main` | `git pull --ff-only origin main` |
| 5. **Apply** | `bash deploy/ec2-pull-update.sh` (lint + activate + secret check) | `pnpm install` → migrate if drizzle changed → `pnpm build` |
| 6. **Restart & verify** | `sudo systemctl reload apache2` if PHP cache complains; then §10 | `sudo systemctl restart aft-portal`; then §10 |

Rules that make this safe:

- **Fetch first, pull second.** Fetching changes nothing on disk; it lets you read
  the incoming commits before you take them.
- **`--ff-only` always.** If Git says *“Not possible to fast-forward”*, **stop**
  (see §8.2). Never use `git pull --rebase`, `git push --force` or
  `git reset --hard origin/main` as a routine step.
- **See nothing coming?** `git log --oneline HEAD..origin/main` prints nothing →
  you are already up to date; run step 6 anyway to re-confirm health.
- **Read the change log** in §14 for that release: it tells you whether a
  migration is needed, which `.env` keys to add, and which one-time steps apply.

### 3.1 Quick reference (copy-paste)

```bash
# ---------- A. WORDPRESS ----------
ssh -i ~/.ssh/id_ed25519 ubuntu@16.28.52.213
cd /var/www/html
git fetch origin && git log --oneline HEAD..origin/main   # review first
bash deploy/ec2-pull-update.sh                            # ff-only pull + php -l + plugin activation
curl -s -o /dev/null -w "%{http_code}\n" http://16.28.52.213/            # 200
curl -s -H "X-AFT-Portal-Secret: <secret>" http://16.28.52.213/wp-json/aft-portal/v1/ping

# ---------- B. PORTAL ----------
cd /opt/aft-learning-portal
mysqldump -u aftportal -p aft_portal > /tmp/aft_portal_$(date +%F_%H%M).sql
git fetch origin && git log --oneline HEAD..origin/main     # review first
git diff --name-only HEAD..origin/main -- drizzle/          # migration needed? (§6.3)
git pull --ff-only origin main
pnpm install
# pnpm exec drizzle-kit migrate     # only if the line above listed drizzle files
pnpm build
sudo systemctl restart aft-portal
curl -s -o /dev/null -w "%{http_code}\n" http://16.28.52.213/exam/       # 200
```

---

## 4. Pre-pull: review exactly what is coming

Do this in the portal directory (it shows commits for the portal repo) and in
`/var/www/html` (WordPress repo). Same three commands:

```bash
git fetch origin

# 1. Which commits am I about to take?
git log --oneline HEAD..origin/main

# 2. Which files change? (this is the safety review)
git diff --stat HEAD..origin/main

# 3. Does it touch configuration, migrations or nginx?
git diff --name-only HEAD..origin/main -- drizzle/ deploy/ .env.example package.json
```

Interpretation guide:

| If you see | Do this |
|---|---|
| `drizzle/0xxx_*.sql` or `drizzle/meta/*` listed | a DB migration is coming → backup (§6.1) and run the migrate step (§6.3) |
| `package.json` / `pnpm-lock.yaml` listed | `pnpm install` is required (step 5) |
| `.env.example` listed | open `git diff HEAD..origin/main -- .env.example` and add the new keys to the server `.env` **by hand** before restarting |
| `deploy/` nginx/systemd files listed | do **not** overwrite blindly — compare with the server copy (§8.5) |
| `Wordpress/wp-content/mu-plugins/*` or theme files | WordPress only — the pull handles it, no DB step |
| only docs/tests | pull, rebuild only if `package.json` changed |

Keep a note of the commit you are on *before* pulling — you need it for rollback:

```bash
git rev-parse --short HEAD     # write this down
```

---

## 5. Update WordPress on EC2 — full instructions

The WordPress repository is a **custom-code only** channel: theme, MU-plugins and
two small plugins. It deliberately excludes core, uploads, databases and every
vendor plugin (Tutor, Elementor, WooCommerce, …), so pulling it cannot disturb
what is already installed.

### 5.0 Preflight

```bash
cd /var/www/html
git status --porcelain --untracked-files=no   # must print nothing
git rev-parse --short HEAD                    # note for rollback
git fetch origin && git log --oneline HEAD..origin/main   # what is coming
```

If `git status` prints tracked changes, the pull script will refuse to run — the
server has been edited by hand. Fix that first (§8.1); do not force past it.

### 5.1 Pull (this is the whole update)

```bash
cd /var/www/html
bash deploy/ec2-pull-update.sh
```

What that script does for you:

- refuses to run if you have local tracked changes on the server (commit/stash first),
- `git fetch` + `git pull --ff-only` — no rebase, no force, never deletes untracked files,
- `php -l` on every tracked PHP file before you rely on them,
- activates `wp-content/plugins/aft-portal-auth` when `wp` CLI is available,
- warns if the exam-portal shared secret has not been stored yet,
- prints the commit that is now live.

Manual equivalent, if you ever need it:

```bash
cd /var/www/html
git fetch origin && git pull --ff-only origin main
git ls-files '*.php' | xargs -n1 php -l            # lint
wp plugin activate aft-portal-auth --path=/var/www/html   # if not already active
```

If the repository is not checked out at the document root, pass the root:

```bash
bash /srv/aftstaging-wordpress/deploy/ec2-pull-update.sh /var/www/html
```

### 5.2 One-time handshake setup (exam portal login from WordPress)

`wp-content/plugins/aft-portal-auth` registers two **read-only** routes:

- `POST /wp-json/aft-portal/v1/verify` — checks a WordPress password **and** an
  active Tutor enrolment, returns user + enrolment JSON to the portal.
- `GET  /wp-json/aft-portal/v1/ping` — health check.

There are no write endpoints; the plugin never modifies users, posts or options.

```bash
# only once, and again whenever you choose a new secret
wp plugin activate aft-portal-auth --path=/var/www/html
wp option update aft_portal_secret 'choose-a-long-random-value' --path=/var/www/html
```

The portal side must carry the **same value** in its `.env` (§6.4). Without it the
routes answer `503 not_configured`, i.e. the integration fails closed instead of
letting anybody in.

Rotate the secret by re-running the `wp option update` line and changing
`WP_SHARED_SECRET` on the portal, then `sudo systemctl restart aft-portal`.

### 5.3 If PHP serves stale code (opcache)

Only needed when a file changed but the page still behaves like the old version:

```bash
sudo systemctl reload apache2        # Apache + mod_php
# or, if PHP runs under FPM:
sudo systemctl reload php8.2-fpm
# hard check:
curl -s http://16.28.52.213/wp-json/aft-portal/v1/ping -H "X-AFT-Portal-Secret: <secret>"
```

### 5.4 Verify

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://16.28.52.213/          # 200
curl -s -H "X-AFT-Portal-Secret: <secret>" http://16.28.52.213/wp-json/aft-portal/v1/ping
# → {"ok":true,"site":"…","version":"1.0.0"}
```

Then load http://16.28.52.213/ in a browser and check the footer shows the logo
image only, and that courses/exams still open.

---

## 6. Update the exam portal on EC2 — full instructions

### 6.0 Preflight

```bash
cd /opt/aft-learning-portal
git status --porcelain --untracked-files=no   # must print nothing
git rev-parse --short HEAD                    # note for rollback
git fetch origin && git log --oneline HEAD..origin/main
git diff --name-only HEAD..origin/main -- drizzle/ .env.example package.json deploy/
systemctl is-active aft-portal
```

### 6.1 Back up the database (every release that touches drizzle, cheap insurance otherwise)

EC2 already has live data — this is what makes every update reversible. Full
database rules (what may change, what may never be touched) are in **§7**.

```bash
cd /opt/aft-learning-portal
STAMP=$(date +%F_%H%M)

mysqldump -u aftportal -p aft_portal > /tmp/aft_portal_${STAMP}.sql
ls -lh /tmp/aft_portal_${STAMP}.sql          # confirm it is not 0 bytes

# inventory of BOTH databases, for the before/after comparison in §7.6
mysql -u aftportal -p -N -e \
 "SELECT table_name, table_rows FROM information_schema.tables
  WHERE table_schema IN ('aft_portal','wordpress') ORDER BY table_schema, table_name;" \
 > /tmp/db_inventory_${STAMP}.txt

# keep both files at least until the release has been verified
```

### 6.2 Pull + install

```bash
git pull --ff-only origin main
pnpm install                            # safe whether or not the lockfile changed
```

### 6.3 Migration — only when this release added drizzle files

```bash
git diff --name-only HEAD@{1} HEAD -- drizzle/     # files brought in by the pull
# (HEAD@{1} = the commit before the pull; if it prints nothing, skip this step)
```

If it printed SQL/meta files:

```bash
cd /opt/aft-learning-portal
export DATABASE_URL="mysql://aftportal:PASSWORD@localhost:3306/aft_portal"
pnpm exec drizzle-kit migrate
```

`drizzle-kit migrate` is idempotent: it records what it has applied, so running it
when nothing is new is a no-op.

> Do **not** run `pnpm run db:push` on the server. It is
> `drizzle-kit generate && migrate`, and `generate` is a workstation command that
> diffs your schema file against the local snapshot. On EC2 run only
> `pnpm exec drizzle-kit migrate`.

### 6.4 Environment variables (`.env` is not in Git)

`.env` on the server is never replaced by a pull. When a release introduces a new
setting, add it by hand **before** restarting:

```bash
cd /opt/aft-learning-portal
nano .env        # add the keys listed in the release notes / §4 table
grep -E '^(WP_VERIFY_URL|WP_SHARED_SECRET|AFT_QA_DEMO_ACCESS)=' .env
sudo systemctl restart aft-portal
```

Keys introduced so far / coming:

| Key | Meaning | If missing |
|---|---|---|
| `WP_VERIFY_URL` | WordPress REST root, e.g. `http://16.28.52.213/wp-json` | WordPress login in the portal fails closed |
| `WP_SHARED_SECRET` | must equal the WordPress `aft_portal_secret` option | login fails closed |
| `AFT_QA_DEMO_ACCESS` | demo/QA login shortcuts — **being removed** | irrelevant once removed |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `S3_BUCKET` / `AWS_REGION` (or an instance IAM role) | S3 storage: profile pictures, resources, printable PDFs — **already configured on EC2**, never committed to Git | uploads fail locally (local `.env` intentionally has no keys); EC2 keeps its existing values |

### 6.5 Build + restart

```bash
pnpm build                 # vite build (client) + esbuild (server) into dist/
sudo systemctl restart aft-portal
```

If `pnpm build` fails: **do not restart** the service (the old `dist/` is still
running and serving users). Read the error, push a fix locally, or roll back
(§9.2).

### 6.6 Verify

```bash
systemctl status aft-portal --no-pager
journalctl -u aft-portal -n 50 --no-pager
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://16.28.52.213/exam/ # 200
```

Then log in as a real staff account and as a learner (§12).

---

## 7. Database updates — change the structure, never the data

**EC2 already has live databases full of students, exams and attempts. An update
must never remove, replace, truncate or re-import them — it may only ADD to them.**
Nothing in either Git repository can drop a database: no release ships a
`DROP DATABASE`, a `.sql` dump of production, or a re-install script. The only
database work a release can carry is a **drizzle migration**, and those are
additive by design.

### 7.1 The two databases on EC2

| Database | Holds | Schema owned by | Credentials |
|---|---|---|---|
| `aft_portal` | portal users, supervisions, exams, questions, attempts, orders, coupons, notifications, messages, profiles | **this repo** — `drizzle/schema.ts`, applied by `drizzle-kit migrate` | `DATABASE_URL` in `/opt/aft-learning-portal/.env` |
| `wordpress` | WordPress users, Tutor courses/enrolments, orders, posts, options (prefix usually `wp_`; check `wp-config.php`) | WordPress core + plugins (Tutor creates its `*_tutor_*` tables on activation) | `DB_NAME` / `DB_USER` / `DB_PASSWORD` in `/var/www/html/wp-config.php` |

Confirm both before working:

```bash
grep -E '^DATABASE_URL=' /opt/aft-learning-portal/.env
grep -E "table_prefix|DB_NAME|DB_USER" /var/www/html/wp-config.php
mysql -u aftportal -p -e "SHOW DATABASES;"      # expect aft_portal and wordpress
```

### 7.2 The rule: additive only

| Allowed in a release | Forbidden in a release |
|---|---|
| `CREATE TABLE` (new tables: profiles, messages, objective results, …) | `DROP DATABASE`, `CREATE DATABASE … ` over an existing one |
| `ALTER TABLE … ADD COLUMN`, `ADD INDEX` | `DROP TABLE`, `TRUNCATE`, `DELETE FROM` |
| new rows written by the app itself | importing any local `.sql` over production |
| one-off corrective SQL **after** a backup, recorded in §14 | hand-editing production rows as part of a deploy |
| idempotent seed scripts (`server/scripts/seed-*.ts` run repeatedly) | `wp db reset`, `drizzle-kit push`, dropping migrations |

### 7.3 Commands that are local-only — never run them on EC2

```bash
# all of these DESTROY the local dev database and are fine ONLY on your laptop:
docker compose -f docker-compose.local.yml down -v      # wipes the local Docker DB
pnpm db:push                                             # drizzle-kit generate + migrate (generate is a workstation step)
mysql < deploy/local/mysql-init/01-databases.sql         # creates the FRESH local databases
wp db reset                                              # WordPress local only
```

On EC2 the equivalent allowed command is only:

```bash
pnpm exec drizzle-kit migrate        # applies migration files that came with the pull
```

### 7.4 Back up before any migration

```bash
cd /opt/aft-learning-portal
STAMP=$(date +%F_%H%M)

mysqldump -u aftportal -p aft_portal > /tmp/aft_portal_${STAMP}.sql
# WordPress DB creds come from wp-config.php:
mysql -u <DB_USER> -p --databases <DB_NAME> > /tmp/wordpress_${STAMP}.sql

ls -lh /tmp/*_${STAMP}.sql          # both must be well over 0 bytes
```

Keep the dumps until the release has been verified (§10). They are the only way
back if a migration misbehaves (§9.3).

### 7.5 Applying a portal migration

```bash
cd /opt/aft-learning-portal
git diff --name-only HEAD@{1} HEAD -- drizzle/     # did the pull bring a migration?
```

- Prints nothing → **no database step at all** this release.
- Prints `.sql` / `meta/*.json` files → apply them:

```bash
export DATABASE_URL="mysql://aftportal:PASSWORD@localhost:3306/aft_portal"
pnpm exec drizzle-kit migrate
```

Drizzle records every file it has applied in the `__drizzle_migrations` table
inside `aft_portal`, so re-running is a no-op. Check what has been applied:

```bash
mysql -u aftportal -p aft_portal -e \
  "SELECT id, name, created_at FROM __drizzle_migrations ORDER BY id DESC LIMIT 5;"
```

> Never run `pnpm run db:push` on the server — it is `generate && migrate`, and
> `generate` is a workstation command (§7.3).

### 7.6 Prove the existing data survived

Capture this **before** the pull and **after** the migration; the only acceptable
difference is *new tables appearing*.

```bash
# inventory + row estimates for both databases
mysql -u aftportal -p -N -e \
 "SELECT table_name, table_rows FROM information_schema.tables
  WHERE table_schema IN ('aft_portal','wordpress') ORDER BY table_schema, table_name;" \
 > /tmp/db_inventory_$(date +%F_%H%M).txt

# a few counts that must be IDENTICAL before and after
mysql -u aftportal -p aft_portal -N -e "SELECT 'users', COUNT(*) FROM users;"
mysql -u aftportal -p aft_portal -N -e "SELECT 'mockExams', COUNT(*) FROM mockExams;"
mysql -u aftportal -p aft_portal -N -e "SELECT 'attempts', COUNT(*) FROM attempts;" 2>/dev/null || true
```

```bash
# WordPress side (prefix from wp-config.php; historic production dump used wpon_)
mysql -u <DB_USER> -p -N -e "SELECT 'wp users', COUNT(*) FROM <prefix>users;"
mysql -u <DB_USER> -p -N -e \
  "SELECT 'enrolments', COUNT(*) FROM <prefix>posts WHERE post_type='tutor_enrolled';"
```

If a count went **down**, stop, do not deploy further, and restore (§9.3).

### 7.7 WordPress side of a release

- The WordPress repository **ships no SQL**. Pulling it changes zero rows —
  `wp_users`, Tutor enrolments and orders are untouched by construction.
- The one-time handshake (§5.2) writes a single option row
  (`wp option update aft_portal_secret …`) — an upsert, never a delete.
- A plugin may create its tables the first time it is **activated** (Tutor did
  this when it was installed). Activation is a manual, one-time step (§5.2),
  never part of a routine pull.
- **Never** import the local/dump WordPress database into EC2, and never run
  `wp db reset` / `wp search-replace` there as part of an update.

### 7.8 Seed data and one-off SQL

- Exam/reference seeds live in `server/scripts/seed-*.ts` and are written to be
  re-runnable (they upsert by id/slug). Run them only when §14's release row says so:

  ```bash
  cd /opt/aft-learning-portal
  export DATABASE_URL="mysql://aftportal:PASSWORD@localhost:3306/aft_portal"
  pnpm exec tsx server/scripts/seed-....ts
  ```

- A one-off data fix (for example correcting a student's attempt) is **not** part
  of a pull. Take the backup in §7.4 first, run the SQL, then add a row to §14
  saying what changed.

### 7.9 If a migration went wrong

```bash
# 1. look at what the migration did
mysql -u aftportal -p aft_portal -e "SHOW TABLES; DESCRIBE <new_table>;"

# 2. additive mistakes are safe to undo
mysql -u aftportal -p aft_portal -e "DROP TABLE IF EXISTS <table_created_by_this_release>;"

# 3. anything touching existing data → restore the pre-release dump (last resort)
mysql -u aftportal -p aft_portal < /tmp/aft_portal_YYYY-MM-DD_HHMM.sql
sudo systemctl restart aft-portal
```

Then pull a fixed migration from the repo; do not hand-patch production schema.

---

### 8.1 “tracked local changes exist … Commit or stash them before pulling”

The server has been edited by hand. **Do not force it.**

```bash
cd /var/www/html        # or /opt/aft-learning-portal
git status --short
git diff                # read what someone changed on the server
```

- The change is worthless → `git checkout -- <file>` (discards the server-side edit) and pull again.
- The change is a real fix → copy it into the local repo instead, commit and push it
  locally, then pull on the server. The server never becomes the source of truth.

### 8.2 “Not possible to fast-forward” / `git status -sb` shows `[ahead N]`

The server has commits that are not on GitHub (someone committed on the box).

```bash
git log --oneline origin/main..HEAD     # see the server-only commits
```

Export them, do not destroy them:

```bash
git format-patch origin/main..HEAD --stdout /tmp/server-local.patch
# keep /tmp/server-local.patch, then:
git reset --hard origin/main            # ONLY after the patch file exists
bash deploy/ec2-pull-update.sh          # or the portal pipeline
```

### 8.3 Portal will not start after the update

```bash
journalctl -u aft-portal -n 100 --no-pager
sudo ss -ltnp | grep 3000                 # port already taken?
cat /opt/aft-learning-portal/.env | grep -E '^[A-Z_]+='   # a new key missing?
```

Most common causes: a new `.env` key not added (§6.4), a failed build (`ls -lh dist/`
— check the timestamp is recent), or a migration that was not run (§6.3).

### 8.4 `/exam/` returns 404 or old assets after a release

```bash
cd /opt/aft-learning-portal && ls -lh dist/index.html dist/assets | head
# rebuild if the timestamp is old:
pnpm build && sudo systemctl restart aft-portal
# nginx side (only if the site config changed):
sudo nginx -t && sudo systemctl reload nginx
```

Hard-refresh the browser (Ctrl+Shift+R) to drop cached JS.

### 8.5 The update changed files under `deploy/` (nginx/systemd units)

Those files are usually **customised on the server**. Compare before accepting:

```bash
git diff HEAD@{1} HEAD -- deploy/
diff -u /etc/nginx/sites-available/aft /var/www/html/deploy/nginx.conf   # example
```

Adopt a change only after `nginx -t` passes:

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl daemon-reload && sudo systemctl restart aft-portal
```

### 8.6 WordPress REST route answers 404

Pretty permalinks missing → the portal can still reach the route with
`?rest_route=/aft-portal/v1/verify`, but fix it properly:

```bash
wp rewrite structure '/%postname%/' --hard --path=/var/www/html
sudo systemctl reload apache2
```

### 8.7 Restore a database backup taken in §6.1

```bash
mysql -u aftportal -p aft_portal < /tmp/aft_portal_YYYY-MM-DD_HHMM.sql
sudo systemctl restart aft-portal
```

This **overwrites everything created after the dump** — only use it when the
migration itself broke the data.

---

## 9. Rollback

Record this before every pull: `git rev-parse --short HEAD`.

### 9.1 WordPress

```bash
cd /var/www/html
git reset --hard <previous-commit>
bash deploy/ec2-pull-update.sh     # re-lints; or just git pull again after a fix is pushed
```

`git reset --hard` on the server only moves **tracked custom code**; uploads,
`wp-config.php` and vendor plugins are untracked and untouched.

### 9.2 Portal

```bash
cd /opt/aft-learning-portal
git reset --hard <previous-commit>
pnpm install && pnpm build
sudo systemctl restart aft-portal
```

### 9.3 Database (last resort)

Restore the dump from §6.1 — only if a migration actually broke the data:

```bash
mysql -u aftportal -p aft_portal < /tmp/aft_portal_….sql
```

Otherwise roll the schema forward with a corrective migration; never hand-edit
production rows during a release.

---

## 10. Post-deploy verification checklist

- [ ] `git log --oneline -1` in `/var/www/html` and `/opt/aft-learning-portal` show the expected commits
- [ ] http://16.28.52.213/ loads (200), footer shows the logo image only
- [ ] A WordPress course page and a lesson still open (Tutor untouched)
- [ ] `/wp-json/aft-portal/v1/ping` answers with the shared secret
- [ ] http://16.28.52.213/exam/ loads (200), client bundle rebuilt (hard refresh)
- [ ] `systemctl status aft-portal` active, no new errors in `journalctl`
- [ ] Portal staff login works
- [ ] Portal learner login works (real account, not a demo account)
- [ ] WordPress-driven portal login works for an enrolled learner
- [ ] DB backup from the release still kept (or safely deleted after a day)
- [ ] Database intact after a migration: `§7.6` inventory diff shows **only new
      tables**, `users`/course/enrolment counts identical to the pre-pull numbers
- [ ] Change log in §14 updated with the commit(s) pulled and a “pulled to EC2” tick

---

## 11. What must never be touched by an update

**Everything below is intentionally *not* in Git — a pull cannot overwrite it,
which is exactly why pulling is safe.**

**On GitHub (the only things a pull changes):**

| Repository | Tracked paths |
|---|---|
| `aftstaging/wordpress` | `wp-content/themes/aft/`, `wp-content/mu-plugins/*.php`, `wp-content/plugins/aft-portal-auth/`, `wp-content/plugins/aft-migration-assistant/`, `deploy/`, `scripts/`, `.github/`, `README.md` |
| `aftstaging/exam-portal` | `client/`, `server/`, `shared/`, `drizzle/`, `scripts/`, `deploy/`, `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `drizzle.config.ts`, `.env.example`, this document, plus the local Docker stack (`docker-compose.local.yml`, `deploy/local/`) |

**WordPress (`/var/www/html`)** — all untracked, therefore safe from `git pull`:

- `wp-config.php`, `.env`, databases
- `wp-content/uploads/` (all student/media data)
- vendor plugins/themes: Tutor LMS + Tutor Pro, Elementor, WooCommerce, etc.
- `wp-admin/`, `wp-includes/`, root core files

**Portal (`/opt/aft-learning-portal`)** — all untracked, therefore safe:

- `.env` (credentials, secrets)
- the MySQL database `aft_portal` (students, exams, attempts, orders)
- `node_modules/`, `dist/` (recreated by `pnpm install` / `pnpm build`)
- nginx site config, systemd unit, TLS certificates

Custom behaviour on the WordPress side belongs in the tracked MU-plugins
(`aft-tutor-private.php`, `aft-tutor-external-lesson-video.php`,
`aft-spam-student-cleaner.php`) — never patch Tutor's vendor files directly.

---

## 12. Credentials used for verification

Local (also valid on EC2 if these accounts exist there — use your own production
accounts for production checks):

| System | Account | Password |
|---|---|---|
| Portal admin | `admin@accountantsfortomorrow.co.za` | `A@F#/t20&26` |
| Portal instructor | `instructor@accountantsfortomorrow.co.za` | `A/IN@20$26` |
| WordPress admin (local) | `Dev` | `Alister@1993` |
| WordPress admin (local, original) | `admin` | `admin` |
| WordPress admin (production) | — | keep on the server, never in Git |

Demo/QA accounts (`demo.*`, `qa.*`, QA login shortcuts, demo cards) are being
**removed** — production verification uses real accounts only.

---

## 13. Status of the current work stream

| # | Area | State |
|---|---|---|
| 0 | Local stack running (WordPress + portal + DB in Docker) | done |
| 0 | Tutor LMS + Tutor Pro installed and activated locally; WP admin `Dev` created | done |
| W1 | `aft-portal-auth` plugin (read-only verify/ping, rate-limited) | done, pushed |
| W2 | WordPress repo completed (theme, MU-plugins, migration plugin tracked), CI green | done, pushed |
| W3 | EC2 pull script gained plugin activation + secret warning | done, pushed |
| W4 | Footer shows the logo image only (wordmark text removed) | done, pushed |
| W5 | Production WordPress secrets/activation on EC2 | **manual, one-time** (§5.2) |
| D1 | `COMBINED-PORTAL-UPDATES.md` operator runbook (incl. §7 database rules: additive-only migrations, backups, before/after inventory) | done, pushed (`eba335e`) |
| D2 | Local Docker stack committed (`docker-compose.local.yml`, `deploy/local/`); nested `Wordpress/` ignored | done, pushed (`eba335e`) |
| S3 | AWS S3 storage (profile pictures, resources, printable PDFs) | configured on EC2 already; local `.env` has no keys on purpose |
| P1 | Remove all demo/QA accounts and QA login shortcuts | pending |
| P2 | Schema: learner profiles, inbox messages, persisted objective results | pending |
| P3 | Comprehensive registration + learner profile page | pending |
| P4 | Portal login via WordPress (one-way, enrolment required) | pending |
| P5 | Dashboard + objective-test result persistence | pending |
| P6 | Instructor stats dashboard, inbox/chat, view learner dashboard | pending |
| P7 | Instructor profile page | pending |
| P8 | Verification, commit, push `aftstaging/exam-portal` | pending |

Portal commits are pushed in one release at the end of P1–P8, so EC2 sees a single
pull with one backup/build/restart cycle.

---

## 14. Change log

Append a row for every change. `pulled` means it is live on EC2.

| Date | Repo | Commit | Change | Pulled to EC2 |
|---|---|---|---|---|
| 2026-10-08 | wordpress | `730c4c4` | Add `aft-portal-auth` plugin; track theme/MU-plugins/migration plugin; `ec2-pull-update.sh` activates the plugin and warns about the secret; CI + README cover the new path | no |
| 2026-10-08 | wordpress | `bf21b39` | Footer wordmark text removed (CI correctly failed on this commit — an accidental plugin deletion slipped in; superseded by `6ca678d`) | no |
| 2026-10-08 | wordpress | `6ca678d` | Restore `aft-migration-assistant` plugin files, CI green | no |
| 2026-10-08 | exam-portal | `eba335e` | This document (pull instructions for both sites, including the database rules in §7), local Docker stack (`docker-compose.local.yml`, `deploy/local/`), `.dockerignore`, ignore the nested `Wordpress/` copy | n/a (operator reads it on GitHub; the local stack is never deployed to EC2) |
| 2026-10-08 | exam-portal | `376830d` | Merged PRs #4–#6 from `arena/*`: exam paper brief shown once on the first page, printable/debrief fixes, task instructions kept inside interactive exams, QA demo access restricted to non-production + `reconcile-production-accounts.ts` (pre-existing upstream work, reviewed before starting P1) | no |
| — | exam-portal | — | P1–P8 portal release (not yet committed) | no |

### Verified locally before pushing

- `php -l` clean on all 38 tracked PHP files (same check CI runs).
- `aft-portal-auth` endpoint answers `401` (bad/absent secret), `403` (valid
  password, no Tutor enrolment), `200` (valid password + active enrolment).
- Portal container → WordPress handshake returns `200` over the Docker network.
- EC2 update simulated end-to-end: a clone pinned to the previous commit
  (`0b7f351`) ran `deploy/ec2-pull-update.sh` and fast-forwarded to `730c4c4`
  with every file checked out and no untracked data affected.
- CI `Validate AFT custom WordPress code` green on `730c4c4` and `6ca678d`.
