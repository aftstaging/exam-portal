# PDF Passing — Node upgrade & PDF upload runbook

This document explains the **"Could not read this PDF: Promise.withResolvers is
not a function"** error in Exam Studio, what was fixed in the code, and the exact
steps to pull the change and run it on the EC2 server.

Give this file to whoever maintains the server. The app code is already fixed —
the only server-side action needed is a **Node.js upgrade to v24** (and a
rebuild). The fix also includes a compatibility shim so PDF import keeps working
even if the server is still on an older Node.

---

## TL;DR for the developer

1. The app code is already fixed — a polyfill was added, so PDF upload works on
   **both** older Node and modern Node.
2. On the server, **upgrade Node.js to v24** (minimum v22) and rebuild/restart.
3. Nothing else changes: no database migrations, no `.env` changes.

```bash
cd /opt/aft-learning-portal
git pull
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v                      # must print v24.x
pnpm install --frozen-lockfile=false
pnpm build
sudo systemctl restart aft-portal
```

---

## 1. Symptom

Uploading a PDF in the admin **Exam Studio → Import from PDF** returns:

```
Could not read this PDF: Promise.withResolvers is not a function
```

The error is raised by the server when it tries to parse the uploaded file, so it
appears no matter which browser is used. Other parts of the site (login, store,
exam taking) keep working.

## 2. Root cause

- PDF parsing in `server/pdfImport.ts` uses **`pdfjs-dist` v6**.
- `pdfjs-dist` v6 calls the JavaScript API **`Promise.withResolvers`**.
- `Promise.withResolvers` was only added to **Node.js 22** (V8 12.2). Node 18 and
  Node 20 do not have it and throw `is not a function`.
- It works on a developer machine because that machine runs Node 24; it fails on
  the server because the server was running an older Node.

This is a **server-side runtime-version problem**, not a problem with the PDF or
with the upload UI.

## 3. What changed in the code

| File | Change |
|---|---|
| `server/_core/polyfills.ts` | **New.** Defines `Promise.withResolvers` when the runtime is missing it. On Node 22+ it does nothing (the native version is kept). |
| `server/pdfImport.ts` | Imports the polyfill first, before `pdfjs-dist`, so the API exists whenever a PDF is parsed. |
| `client/src/components/ExamStudio.tsx` | Removed the redundant standalone "Pre-moderated exam paper" section (the top "Import from PDF" section already stores the question paper). |

- Fix commit: `48286c7` — "Polyfill Promise.withResolvers so PDF import works on Node < 22"
- Related commit: `30e4f13` — "Remove redundant pre-moderated exam paper section from ExamStudio"
- Branch: `main`
- No database schema change and no `.env` change.

Because the polyfill is a **no-op** on modern Node, this change is safe on every
Node version — it only makes older runtimes behave like newer ones.

## 4. Recommended: upgrade Node.js on the server

Check the current version:

```bash
node -v
```

If it does **not** print `v24.x`, upgrade with NodeSource (this is exactly what
`deploy/setup-ec2.sh` installs):

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v            # expected: v24.x
pnpm -v            # expected: 10.x  (install with: sudo npm install -g pnpm@10)
```

Node 22 is the minimum that natively supports `Promise.withResolvers`; **v24 is
recommended** because it matches local development and the deployment scripts.

## 5. Make sure all app features work on the upgraded Node

The application is developed, tested and deployed on Node 24, so upgrading does
not require further code changes. To make the expected runtime explicit and avoid
future drift, the repository now also pins it:

- `.nvmrc` → `24`
- `package.json` → `"engines": { "node": ">=22" }`

After upgrading the runtime, reinstall dependencies and rebuild so native/bundled
packages match the new Node:

```bash
cd /opt/aft-learning-portal
pnpm install --frozen-lockfile=false
pnpm test          # full test suite should pass
pnpm build
sudo systemctl restart aft-portal
```

If you use `nvm` on the server, `nvm use` (or `nvm install 24`) will read
`.nvmrc` and select the right version automatically.

## 6. Pull the update and release

On the EC2 server:

```bash
cd /opt/aft-learning-portal

# 1. Pull the latest code
git pull

# 2. Upgrade Node (only needed once — see section 4)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install dependencies
pnpm install --frozen-lockfile=false

# 4. Migrations — NOT required for this change (no schema change). Skip.

# 5. Build the production bundle (client + server)
pnpm build

# 6. Restart the app service
sudo systemctl restart aft-portal
```

Health check:

```bash
sudo systemctl status aft-portal
sudo journalctl -u aft-portal -n 50 --no-pager
```

## 7. Verify

1. Sign in as staff/admin → open **Exam Studio**.
2. Under **Import from PDF → Question paper (PDF)**, upload a case-study PDF
   (for example `source-pdfs/cartn-mock-3-questions.pdf`).
3. Expect: a success toast and the form filled in (title, tasks/resource
   attachments). The error must **not** appear.
4. Confirm the server Node version:
   ```bash
   node -v      # v24.x
   ```
5. Spot-check the main flows after the runtime upgrade: login, store checkout,
   starting and submitting an exam, and downloading a protected PDF.

## 8. Notes / fallback

- If the Node upgrade is not possible yet, **PDF import still works after this
  change** because of the polyfill — as long as the updated code is rebuilt and
  the service restarted. Upgrading Node simply removes the need for the shim and
  keeps the server aligned with the version the app targets.
- Do not edit `source-pdfs/` or delete `server/_core/polyfills.ts`: the polyfill
  is intentionally permanent for compatibility and is harmless on new runtimes.
