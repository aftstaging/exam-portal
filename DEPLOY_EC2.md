# EC2 Deployment Guide — AFT Learning Portal

The app is fully self-hosted (local auth, AWS S3 storage).
Deploy on a single Ubuntu 24.04 EC2 instance behind nginx.

## 1. Provision the instance

- Instance type: `t3.small` (2 vCPU / 2 GiB) minimum — the portal uses Node + MySQL + nginx.
- AMI: Ubuntu 24.04 LTS.
- Storage: 20–30 GB gp3 (build artifacts + MySQL data).
- Security group: open `22`, `80`, and `443` to the internet.
- Give the instance an **IAM role** with an S3 policy (PutObject/GetObject on your bucket)
  so the app can write files without storing access keys. Keys also work, see `.env`.

## 2. Get the code onto the box

Copy the repository to the server (git clone, or zip/rsync). The repo is at
`C:\Users\marjo\Downloads\Aft Backup\aft-learning-portal`.

## 3. Run the setup script

```bash
sudo bash deploy/setup-ec2.sh /path/to/aft-learning-portal yourdomain.co.za
```

The script:

1. Installs Node 24, pnpm, nginx, MySQL 8, certbot.
2. Prompts for a DB password, then creates database `aft_portal` and user `aftportal`.
3. Installs the app to `/opt/aft-learning-portal` and writes `.env` (random `JWT_SECRET`).
4. Runs `pnpm install` and the drizzle migrations (schema is in `drizzle/`).
5. Builds the production bundle.
6. Installs the systemd unit `aft-portal.service` and nginx site, starts them.

## 4. HTTPS (Let's Encrypt)

```bash
sudo certbot --nginx -d yourdomain.co.za
```

The session cookie becomes `Secure; SameSite=None` automatically because nginx
forwards `X-Forwarded-Proto: https` (see `server/_core/cookies.ts`).

## 5. Configure storage + payments

Edit `/opt/aft-learning-portal/.env`:

| Variable | Purpose |
|---|---|
| `AWS_REGION`, `S3_BUCKET` | S3 bucket for printable PDFs, admin resources, objective attachments |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Only if not using the instance IAM role (leave empty to use the role) |
| `S3_ENDPOINT` | Optional: S3-compatible endpoint (MinIO/localstack) |
| `PAYFAST_MODE`, `PAYFAST_*_MERCHANT_ID/KEY/PASSPHRASE` | Storefront checkout (sandbox vs live) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional Stripe webhook integration |
| `OWNER_EMAIL` | Registering this email auto-promotes the user to admin |

Then:

```bash
sudo systemctl restart aft-portal
```

## 6. Create accounts

Browse to the site, click **Create account**, and register with `OWNER_EMAIL`
(`admin@accountantsfortomorrow.co.za` by default). That user becomes admin.

Re-create the demo accounts on the server (idempotent):

```bash
cd /opt/aft-learning-portal
pnpm exec tsx server/scripts/seed-demo-accounts.ts
```

Demo logins:

- Admin: `demo.admin@accountantsfortomorrow.co.za` / `AdminDemo!2026`
- Student: `demo.student@accountantsfortomorrow.co.za` / `StudentDemo!2026`

## 7. Operations

```bash
sudo systemctl status aft-portal   # app health
sudo journalctl -u aft-portal -f   # app logs
sudo systemctl restart aft-portal  # apply .env/build changes
```

**Releases**: on each deploy re-run `pnpm install --frozen-lockfile=false`, `pnpm exec drizzle-kit migrate` (with `DATABASE_URL` exported), `pnpm build`, then `systemctl restart aft-portal`.

**Load the exams (required once and again after any exam/PDF changes)** — the schema
migrations do NOT create exam catalogue records or upload PDFs. Run the idempotent
import script after S3 is configured:

```bash
cd /opt/aft-learning-portal
pnpm exec tsx server/scripts/seed-exams.ts
```

This imports the case-study + objective-test catalogues into MySQL and uploads the
`source-pdfs/` files to S3, attaching them to the matching protected resources. Safe to
re-run at any time.

## Files

- `deploy/setup-ec2.sh` — full provisioning script (steps 3 above).
- `deploy/aft-portal.service` — systemd unit (Node, `NODE_ENV=production`).
- `deploy/nginx-aft-portal.conf` — nginx reverse proxy (TLS, 60 MB uploads, static caching).
- `.env.example` — documented production environment template.

## Production-mode verification

After the build, `NODE_ENV=production node dist/index.js` serves the SPA on `:3000`
(static shell + `/api/trpc` + `/storage/*`). Verified locally: home page, tRPC health,
and local `/assets/*` all return 200 with zero console errors.