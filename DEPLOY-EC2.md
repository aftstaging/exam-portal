# AFT Learning Portal — EC2 Deployment Guide

**Date:** 3 September 2026  
**Latest commit:** `6ccbf75` — *Fix: React 18 compatibility and Vite config updates*  
**Repository:** https://github.com/aftstaging/exam-portal

---

## Recent Changes (commits to pull)

| Commit | Description |
|--------|-------------|
| `6ccbf75` | React 18 downgrade, Vite manual chunking fix, wouter patch removed |
| `2039012` | Coupon code system — admin CRUD, cart integration, PayFast extra fields |
| `edaad26` | Per-section timing builder and exam feedback for case-study module |
| `d6d5afb` | Dedicated instructor exam studio with conditional case-study/objective-test modules |
| `a38bafe` | "Return to home" button on case-study exam submission confirmation |
| `1bd9981` | "Return to home" button on test results panel |
| `7f4a1f7` | Review topic chart fix — always show a bar for 0% topics |
| `461246e` | Per-option rationale to objective questions and review feedback |
| `654221b` | Detailed objective test review with topic performance chart |
| `99dbc00` | Objective-test tools, product editing, test input legibility fixes |

---

## What changed in this release

### React 18 downgrade
- `react` and `react-dom` pinned to `18.3.1` (was `19.2.1`)
- `@types/react` pinned to `18.3.31`, `@types/react-dom` to `18.3.7`
- `patches/wouter@3.7.1.patch` deleted — no longer needed

### Vite config
- Added `base: '/'` for correct asset paths behind reverse proxies
- Simplified `manualChunks` — React core in `react-vendor`, everything else in `vendor`
- Removed framer-motion and pdf-lib as separate chunks (now in `vendor`)

### Coupon system (new)
- **New tables:** `coupons`, `couponRedemptions`
- **Migration:** `drizzle/0012_parched_abomination.sql`
- Admin console: create/disable/enable coupon codes (percent or fixed-rand)
- Cart: coupon input field, real-time validation before checkout
- PayFast: coupon code passed via `custom_str4` field
- Server: `validateCoupon`, `createAdminCoupon`, `revokeCoupon`, `clickCoupon` functions

### Instructor exam studio
- Instructors can create/edit objective-test exams with per-section timing
- Exam builder supports conditional sections (case-study vs objective-test)

### Case-study improvements
- Per-section timing configuration and feedback
- "Return to home" button on submission confirmation and test results

### Objective-test improvements
- Detailed review with per-option rationale
- Topic performance bar chart on results
- Product editing and input legibility fixes

---

## Deployment steps on EC2

Run these commands on the EC2 server:

```bash
cd /opt/aft-learning-portal

# 1. Pull latest code
git pull origin main

# 2. Install dependencies (React 18 + removed wouter patch)
pnpm install

# 3. Apply database migration (new coupon tables)
pnpm run db:push

# 4. Build the frontend and server
pnpm run build

# 5. Restart the service
sudo systemctl restart aft-portal
```

### Verify it's running

```bash
# Check service status
sudo systemctl status aft-portal

# Check the app is responding
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# Should return 200

# Check logs if something is wrong
sudo journalctl -u aft-portal --no-pager -n 30
```

---

## New database tables

The migration `0012_parched_abomination.sql` creates:

```sql
CREATE TABLE `coupons` (
  `id` int AUTO_INCREMENT NOT NULL,
  `code` varchar(40) NOT NULL,
  `discountType` enum('percent','fixed') NOT NULL,
  `value` int NOT NULL,
  `maxUses` int NOT NULL DEFAULT 0,
  `usedCount` int NOT NULL DEFAULT 0,
  `status` enum('active','disabled') NOT NULL DEFAULT 'active',
  `expiresAt` timestamp,
  `createdBy` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`),
  UNIQUE (`code`)
);

CREATE TABLE `couponRedemptions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `couponId` int NOT NULL,
  `userId` int NOT NULL,
  `amountCents` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`)
);
```

`pnpm run db:push` handles this automatically via drizzle-kit migrate.

---

## Rollback plan

If something breaks after deployment:

```bash
# Revert to previous version
git log --oneline -5   # find the commit before ours
git checkout <previous-commit> -- .

# Rebuild and restart
pnpm install
pnpm run build
sudo systemctl restart aft-portal
```

To revert the database migration manually if needed:

```sql
DROP TABLE IF EXISTS `couponRedemptions`;
DROP TABLE IF EXISTS `coupons`;
```

---

## Notes

- The wouter patch file has been removed from the repo. If the EC2 server still has a stale `patches/` directory, `pnpm install` will ignore it since `package.json` no longer references it.
- All builds are verified locally before pushing. The `react-vendor` chunk is 143 KB (gzip 46 KB) — well within acceptable limits.
- No React 19-specific APIs are used anywhere in the client codebase. The downgrade is safe.
