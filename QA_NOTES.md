# QA Notes

## Public route verification — 27 August 2026

- `/objective-tests` renders the AFT Objective test course overview for E2 Managing Performance, shows the AFT-created content boundary, displays the published-question count, and offers Test Yourself Extra plus Online mock entry points. Case Study-only Pre-seen, Formulae + tables, and Calculator controls are absent.
- `/mock-exams` renders the combined mock-exam store with the Objective test, Case Study, and instructor-marking product categories. Product cards show the 30-day default access language, featured imagery, account-linked access, and cart-based actions.
- `/admin` redirects to the public home page when no authenticated session is present. The standard login flow opens, but the browser session did not receive administrator credentials or complete human verification.

## Authenticated QA limitation

The following items remain intentionally pending until an authenticated administrator/learner session is available: provisioning `demo@accountantsfortomorrow.co.za`, verifying its 60-day entitlement set, and interactively replaying protected resource downloads and admin visibility. The server-side provisioning procedure is admin-gated, idempotent, and covered by a non-admin rejection test; no direct database seeding was performed.

## Automated validation

- TypeScript: passed.
- Vitest: 38 tests passed across 13 files.
- Production build: passed; Vite emitted only the existing chunk-size advisory.

## Demo database check

A read-only query on 27 August 2026 found no user with email `demo@accountantsfortomorrow.co.za` and no associated entitlement rows. This confirms the provisioning action has not been run and that no demo data was inserted during QA.

## Responsive visual verification

The Objective test course overview and combined mock-exam store were also captured at 375px width. The AFT logo and primary CTA remain visible in the compact header; long course/store headings wrap without horizontal clipping; course summary and secure-access panels remain readable; and the mobile surfaces preserve the dark-violet, mint, cyan, white, and lavender design system. This visual check does not substitute for authenticated checkout or protected-download interaction testing.

## Objective workspace reference inspection

The supplied Drive image was retrieved through its direct download endpoint and viewed at 1918×480. The reference is a very wide, low-chrome exam pad: a solid blue top bar contains `Question 1` at left and `1 of 60` plus `Time remaining: 1 hour, 16 minutes 37 seconds` at right. The white question area places the prompt near the upper-left, followed by a numbered two-statement stem and vertically stacked radio options. A small question/reference code appears near the lower-right. A full-width light-grey bottom action bar contains `End Assessment` on the left and compact dark controls on the right in this order: `Calculator`, `Scratch Pad`, `Flag`, `Navigation`, `Back`, `Next`, with `Next` highlighted blue. This differs materially from the current violet card-and-sidebar workspace and is the target structure for the next revision.

## Reference-layout QA

The revised Objective workspace was replayed through the staged course → mock instructions → welcome → question flow in the development preview. At desktop width, the exam now presents a blue top bar with `Question 1`, question count, and a readable long-form timer; a white question canvas with dark readable prompt and radio rows; the AFT question reference at lower right; and a full-width grey bottom action bar with End Assessment, Calculator, Scratch Pad, Flag, Navigation, Back, and Next. A global dark-theme override was scoped so the white canvas no longer renders dark or hides the question text.

## Compact AFT palette QA

The Objective test course page now uses a tighter max-width, smaller heading scale, reduced card padding, shorter line lengths, and compact assessment cards while preserving the CIMA-style course summary and assessment hierarchy. Desktop QA at 1280px shows the dark-violet background, electric-cyan borders, mint labels, white CTAs, and balanced two-column assessment layout. Mobile QA at 390px shows the header, course summary, and assessment cards stacking cleanly with readable text and touch-sized actions.

## Temporary free test-product QA

Published case-study products 1–3 and Objective products 30001–30003 were changed to `priceCents = 0`; published marking remains paid. The Objective product 30003 route renders as a centered, compact AFT dark-violet panel with electric-cyan borders, mint labels, lavender copy, and white Start/Open assessment CTAs. The mock-exam store renders the test products as Free with Start exam actions while keeping the instructor-marking add-on paid with Add to cart.

## Compact Objective exam-pad QA

The Objective quiz workspace was changed from a full-screen white surface to a centered exam canvas with a dark-violet outer frame, responsive side margins, rounded border, and contained shadow. The blue question header, white question area, answer controls, question reference, and grey action bar remain inside the canvas; the footer is no longer fixed to the viewport. TypeScript and all 38 Vitest tests pass, and the product-specific course route remains readable at 1280px and 390px widths. The staged quiz shell uses the same compact container rules when the learner enters the question stage.

## Objective exam-pad height and deep-violet palette QA

The Objective exam pad now uses a reduced vertical footprint: 430px minimum on small screens, 460px at the standard breakpoint, and 500px on large screens, with the surrounding AFT frame vertically centering it on larger viewports. The former `#0877bd` header and Next/Submit accents are now `#18093c`, with `#24105c` hover states and matching deep-violet utility controls. The white question canvas and grey action bar remain high-contrast. Desktop and mobile course-route previews remain readable, and TypeScript, 38 Vitest tests, and the production build pass.

## Exact Objective route verification

The published route `/objective-tests?mockExamId=30003&productId=30003` was replayed through its intended staged flow: course overview, Online mock instructions, welcome screen, and Start mock exam. The resulting question pad is the compact centered version with a deep-violet `#18093c` header and contained bottom controls; it is not the previous full-screen blue layout. The direct route intentionally opens the course stage first rather than bypassing the assessment journey.

## Windows local launcher fix

The downloaded project reported `Error: spawn EINVAL` in PowerShell because the launcher attempted to spawn Windows command invocations in a way that is fragile on Node 24. The launcher now starts the server through `ComSpec` with `npm.cmd run dev:server` and opens URLs through `explorer.exe`, which delegates to the configured default browser. `npm run dev` was exercised in headless mode with `AFT_OPEN_BROWSER=false` and `PORT=3199`; the server started successfully. Launcher syntax, TypeScript, all 38 Vitest tests, and the production build pass.
