# Accountants for Tomorrow LMS — Technical Handover

## 1. Project overview

This repository contains the **Accountants for Tomorrow (AFT) Learning Management and Examination Portal**. It is a Node.js full-stack application for professional accounting exam preparation. The current product combines a public mock-exam catalogue, Case Study simulations, CIMAStudy-inspired Objective tests, a learner dashboard, instructor marking workflows, admin content management, protected resources, generated printable exams, and payment infrastructure.

The live application is available at [https://acctlearn-ymm46xap.manus.space](https://acctlearn-ymm46xap.manus.space). The current published checkpoint is `4bbede91`. The codebase is intended to run as a managed Manus web project, but it can also be developed locally with Node.js and pnpm.

> Important current state: all published Case Study and Objective test products have temporarily been set to `priceCents = 0`, so they show **Start exam** / free-enrollment actions. The instructor-marking add-on remains paid. PayFast checkout and the admin pricing controls remain implemented for future reactivation.

## 2. Technology stack

| Layer | Technology | Implementation location |
|---|---|---|
| Frontend | React 19, TypeScript, Vite | `client/src/` |
| Routing | Wouter | `client/src/App.tsx` |
| API contract | tRPC 11 with Zod validation | `server/routers.ts` |
| Server | Express 4, Node.js, ESM | `server/_core/index.ts` |
| Database | MySQL/TiDB through Drizzle ORM | `drizzle/schema.ts`, `server/db.ts` |
| Styling | Tailwind CSS 4 and project CSS tokens | `client/src/index.css` |
| Authentication | Manus OAuth session cookies | `server/_core/context.ts`, `client/src/_core/hooks/useAuth.ts` |
| File storage | Managed S3 helpers | `server/storage.ts`, `server/_core/storageProxy.ts` |
| Payments | PayFast hosted checkout and ITN verification; legacy Stripe foundation also remains | `server/payfast.ts`, `server/routers.ts`, `server/stripe.ts` |
| Testing | Vitest | `server/*.test.ts`, `shared/*.test.ts` |
| PDF generation | `pdf-lib` plus AFT branding | `server/pdf.ts` |

The application is configured as an ESM project. The server reads the runtime port from `process.env.PORT`; do not hardcode a production port.

## 3. Running the project

Install dependencies with `pnpm install`. Start development with `pnpm dev`. Run TypeScript validation with `pnpm check`, run the complete test suite with `pnpm test`, and create a production build with `pnpm build`. The production bundle is started with `pnpm start` after `pnpm build`.

The package scripts are:

| Command | Purpose |
|---|---|
| `pnpm dev` | Starts the Express/Vite development environment with file watching. |
| `pnpm check` | Runs `tsc --noEmit`. |
| `pnpm test` | Runs Vitest. |
| `pnpm build` | Builds the Vite frontend and bundles the Node server with esbuild. |
| `pnpm start` | Starts the compiled production server. |
| `pnpm db:push` | Generates and applies Drizzle migrations; use the managed schema workflow carefully. |

The current validation result is **38 passing Vitest tests across 13 files**, passing TypeScript checks, and a passing production build. The build emits only the existing Vite chunk-size advisory.

## 4. Public and learner routes

| Route | Purpose |
|---|---|
| `/` | AFT public homepage with brand hero, exam discovery, and calls to action. |
| `/mock-exams` | Combined Case Study, Objective test, and marking-product catalogue. Case Study and Objective test products are currently free. |
| `/objective-tests` | Objective test course overview. Supports `productId`, for example `/objective-tests?productId=30003`. |
| `/study-resources` | Public study-resource discovery surface. |
| `/dashboard` | Protected learner account, entitlements, attempts, progress, results, and record-specific deep links. |
| `/cart` | Protected learner cart and PayFast checkout preparation for paid products. |
| `/admin` | Admin-only management console. Unauthenticated access redirects to the public experience. |

The global header contains Home, Mock exams, Study resources, My Account, and Cart. The Mock exams item has a dropdown separating **Case study** and **Objective test** destinations, while direct navigation opens the complete catalogue. Courses were intentionally removed from the public navigation as requested.

## 5. Objective test experience

The Objective test experience follows a staged course flow inspired by the supplied CIMAStudy references while using AFT branding:

1. Course overview with course summary, category, published question count, Test Yourself Extra, and Online mock.
2. Test Yourself Extra instructions.
3. Student customization, including topic selection, 20- or 60-question attempt size, and timed/untimed mode.
4. Mock exam instructions.
5. Welcome screen.
6. Full Objective question workspace.
7. Submission and post-submit review with score, percentage, correct answers, and explanations.

The question bank is larger than any individual attempt. Students select the attempt size; instructors populate the bank. The seeded Objective products have hundreds of original AFT-created questions distributed across topics. Supported question types include single choice, multiple choice, dropdown, numerical input, and text input. Admin authoring also supports PNG, JPEG, WebP, and GIF question attachments through managed storage.

The current question workspace is a compact reference-style exam pad with a blue exam header, question count, readable timer, white question canvas, dark readable text, compact answer rows, lower-right AFT question reference, and a grey action bar. The Scratch pad and long numbered question strip were removed from the active workspace. Correctness feedback, scores, percentages, explanations, and review controls remain hidden during an active attempt and are shown only after submission.

The main implementation is in `client/src/components/ObjectiveTestsPanel.tsx`. Shared parsing and scoring logic is in `shared/objectiveTest.ts`, with tests in `server/objectiveTest.test.ts`.

## 6. Case Study experience

The Case Study system remains separate from Objective tests. It includes a mock-exam store, debrief, exam mode selection, printable mode, online mock with illustrative solutions, marking-feedback instructions, intro cooldown, full-screen question workspace, timer, autosave, rich-text answer pad, word count, reference material, email attachment, submission confirmation, marking opt-out, and post-completion solution access.

The Case Study shell preserves the requested utility controls: Pre-seen, Formulae + tables, Calculator, Help, and End session. The calculator is functional and keyboard-safe. Imported resources and printable PDFs are protected according to the active product and entitlement rules. The relevant shared logic is in `shared/examFlow.ts`, `shared/examCalculator.ts`, `shared/integrity.ts`, and `shared/solutions.ts`.

## 7. Commerce and access periods

The cart supports multiple products. Free products are enrolled through the protected free-claim procedure. Paid products create a signed PayFast hosted checkout form. Server-side ITN validation verifies the PayFast signature, payment status, amount, and product identifiers before entitlement fulfillment. The PayFast integration is intentionally fail-closed while real merchant credentials are absent.

Products contain `priceCents` and `accessDays`. New products default to 30 days. Entitlements calculate expiry from the product access period and are checked server-side. The admin can change product pricing and access duration. Current temporary database configuration sets published Case Study products 1–3 and Objective products 30001–30003 to zero price; the marking product remains paid.

Do not hardcode payment credentials or edit `.env` files. Use the project’s secret-management flow for credentials. Before enabling real PayFast payments, configure the required sandbox or live merchant values and re-run payment tests and ITN verification checks.

## 8. Database model

The main schema is in `drizzle/schema.ts`. It includes users, qualifications, qualification levels, products, entitlements, resources, mock exams, Case Study sections, attempts, answers, submissions, Objective questions, markings, rubric criteria, feedback states, notifications, payment gateway settings, and audit events.

File bytes are not intended to live in the database. Store files in managed S3 storage and keep only file keys, URLs, mime types, and related metadata in database rows. Schema changes should be made in `drizzle/schema.ts`, followed by generated migration review and managed SQL application.

## 9. Admin functionality

The admin console is role-gated with `ctx.user.role === "admin"`. It supports product creation, publishing, price changes, access-period changes, featured image URLs, mock-exam creation, Case Study section management, Objective question authoring, attachment uploads, protected resource uploads, printable-PDF generation, marking-product management, PayFast sandbox/live mode selection, and the isolated demo-learner provisioning control.

The demo procedure is `provisionDemoLearner` in `server/db.ts`. It creates or reuses the clearly labelled demo identity `demo@accountantsfortomorrow.co.za`, attaches all published Case Study and Objective products, and refreshes them to one active 60-day entitlement window without duplicate entitlement rows. It also writes an audit event. The procedure is admin-only and has a non-admin rejection test. The live database was checked read-only and no demo learner was created because an authenticated admin session was not available.

## 10. Important files

| File | Responsibility |
|---|---|
| `client/src/App.tsx` | Frontend routes and page composition. |
| `client/src/components/ObjectiveTestsPanel.tsx` | Objective staged journey, customization, quiz workspace, controls, scoring display. |
| `client/src/pages/Catalogue.tsx` | Storefront cards, free enrollment, cart actions, featured images. |
| `client/src/pages/Cart.tsx` | Learner basket and checkout flow. |
| `client/src/pages/Admin.tsx` | Admin console and management actions. |
| `server/db.ts` | Database helpers, entitlements, exam starts, submissions, admin CRUD, demo provisioning. |
| `server/routers.ts` | Typed public, protected, and admin tRPC procedures. |
| `shared/objectiveTest.ts` | Objective question parsing, selection, answer matching, and scoring. |
| `shared/integrity.ts` | Attempt editability, submission locking, and entitlement safety helpers. |
| `server/payfast.ts` | PayFast endpoint selection, signature generation, checkout fields, ITN verification. |
| `server/pdf.ts` | Branded printable exam generation. |
| `drizzle/schema.ts` | Database table definitions and enums. |
| `client/src/index.css` | Global AFT palette, theme variables, and scoped reference workspace styles. |
| `todo.md` | Feature history and remaining QA backlog. |
| `QA_NOTES.md` | Visual, automated, database, and authentication QA notes. |

## 11. Current visual system

The brand system is a high-contrast dark violet interface: `#0C0524` to `#18093C` backgrounds, `#120730` card surfaces, electric cyan `#00E5FF` interactive accents, mint green `#00FF88` active states, white headings and CTA surfaces, and lavender-tinted secondary text such as `#C4B5FD`. The official AFT logo is referenced from managed storage and is used across public navigation, exam surfaces, and administrative areas.

The Objective course panel at product 30003 is intentionally narrower and centered. It uses compact padding, shorter line lengths, reduced heading sizes, cyan borders, mint labels, lavender copy, and white action buttons. The reference-style question workspace is scoped separately so it can retain its light question canvas without being overridden by the global dark theme.

## 12. Remaining work for the next vibe coder

The remaining TODO items are primarily authenticated validation tasks rather than missing core features. They are intentionally left open because no administrator/learner session was available during the last QA pass:

| Priority | Remaining work | Notes |
|---|---|---|
| High | Provision the isolated demo learner. | Use the Admin console action; do not seed directly in SQL. |
| High | Verify the demo learner has every published Case Study and Objective product. | Confirm exactly one active entitlement per product and a 60-day expiry. |
| High | Run authenticated learner QA. | Test free enrollment, Case Study start, printable PDF delivery, feedback-resource access, Objective start, submission lock, and dashboard days remaining. |
| High | Run authenticated admin QA. | Confirm product, section, question, resource, pricing, PayFast, and demo controls. |
| Medium | Interactively validate mock-exam selection and auth/checkout gating at desktop and mobile widths. | Free test products should start directly; paid marking should remain cart-based. |
| Optional | Add a temporary QA/demo learner access mode. | If implemented, isolate it to demo-only learner data, keep admin/payment/resource controls secure, label it visibly, and document the rollback switch. |

## 13. Handover cautions

Do not remove server-side authorization merely to make browser QA easier. Do not expose admin procedures through public routes. Do not create fake customer reviews, ratings, or testimonials. Do not store uploaded file bytes in database columns. Do not make destructive schema or database changes without reviewing the migration and data impact. Preserve the distinction between original AFT-created practice content and official CIMA material.

When making changes, add an unchecked entry to `todo.md` first, implement the change, write or update Vitest coverage, run `pnpm check`, `pnpm test`, and `pnpm build`, capture responsive screenshots where appropriate, update `QA_NOTES.md`, mark only genuinely completed TODO entries as checked, and save a new project checkpoint before delivery.

## 14. Suggested next session sequence

First, open `/admin` and complete administrator authentication. Next, use the demo provisioning action and confirm the success response. Then open the learner dashboard using the demo identity and inspect product entitlements and expiry dates. Validate one free Objective product, one free Case Study product, the Objective 20/60 customization flow, a complete Objective submission, and one protected printable/resource path. Finally, test the admin pricing control by changing a product in a controlled environment and return it to the intended free or paid state.

This handover document is part of the repository and should be updated whenever a major workflow, schema, payment setting, route, or QA result changes.

## 15. Local browser launch behavior

The project opens the local portal automatically when the next developer runs `npm run dev`. The command starts the Node development server through `scripts/dev-launcher.mjs`, waits for the server startup message, and opens `http://localhost:<PORT>` in the system default browser. On Windows PowerShell, the launcher uses the Windows command processor to run `npm.cmd` and `explorer.exe` to delegate the URL to the default browser; this avoids the `spawn EINVAL` failure caused by directly spawning a `.cmd` file or using fragile `cmd /c start` quoting. The existing server-only command is available as `npm run dev:server` for headless machines, containers, and CI. Automatic opening can be disabled with `AFT_OPEN_BROWSER=false`; a custom port is picked up from `PORT`, and `AFT_DEV_URL` can override the URL opened by the launcher.
