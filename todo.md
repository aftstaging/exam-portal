# Project TODO

- [x] Apply the official Accountants for Tomorrow visual identity with deep navy navigation, vivid green actions, pale mint exam surfaces, and no chat, Teams, or support overlays.
- [x] Build the public portal homepage with course and exam discovery plus authentication entry points.
- [x] Build public course, qualification, mock-exam, study-resource, and product discovery views.
- [x] Build authentication entry points and protected student account routing using the existing Manus OAuth flow.
- [x] Build the student dashboard for owned products, progress, saved attempts, resume actions, and account information.
- [x] Extend the database schema for qualifications, levels, products, entitlements, resources, mock exams, case-study sections, attempts, answers, submissions, objective-test questions, feedback, marking, notifications, and audit events.
- [x] Add database helpers and typed tRPC procedures for catalogue, dashboard, exam, resource, marking, and administration workflows.
- [x] Apply and verify the database migration through the schema-first workflow.
- [x] Build the case-study mock-exam selection screen.
- [x] Build the case-study exam debrief screen.
- [x] Build the exam-mode selection screen for Interactive, Printable, Online mock with solutions, and Marking feedback instructions.
- [x] Build the full-screen exam shell with persistent Pre-seen, Formulae + tables, Calculator, Help, and End session controls.
- [x] Build server-controlled attempt state, visible remaining time, autosave, exit confirmation, and locked submissions.
- [x] Build the Section 1 introduction with a mandatory 30-second countdown.
- [x] Build the case-study task workspace with question, timing/instructions, Email, Reference material, rich-text Answer pad, word count, Save, and Next.
- [x] Build final review and submission confirmation with opt-out-of-marking behavior.
- [x] Build protected resource delivery for pre-seen documents, formulae tables, printable PDFs, feedback files, and course resources.
- [x] Build the objective-test foundation with configurable practice sets, topic filters, timed/untimed modes, question grid, flagging, scratch pad, scoring, and feedback.
- [x] Build role-gated content administration for products, mock exams, sections, resources, and objective-test questions.
- [x] Build case-study marking foundations with marker queues, rubrics, feedback, and student feedback views.
- [x] Add payment integration scaffolding with server-verified completion and entitlement granting.
- [x] Add account, purchase, submission, and marking-completion notices.
- [x] Add Vitest coverage for core procedures, attempt integrity, autosave, submission locking, entitlements, and role gates.
- [x] Run type checks, tests, and visual verification at desktop and mobile breakpoints.
- [x] Save the final project checkpoint and deliver the project version.

- [x] Replace the invented mark with the official Accountants for Tomorrow logo asset and apply it consistently.
- [x] Implement dedicated catalogue/discovery pages backed by tRPC queries for courses, qualifications, products, and study resources.
- [x] Enforce protected routing for student and admin pages and connect dashboard data to live entitlements and attempts.
- [x] Add missing schema entities for qualification levels, submissions, and explicit feedback states.
- [x] Add admin and marking procedures and connect the corresponding UI actions.
- [x] Wire the exam UI to backend attempt APIs, implement a real controlled countdown, autosave, exit confirmation, and locked submission flow.
- [x] Implement entitlement-enforced protected file delivery.
- [x] Complete objective-test scratch pad, scoring, and feedback.
- [x] Implement Stripe checkout and webhook entitlement granting.
- [x] Add account, purchase, submission, and marking-completion notification procedures.
- [x] Add broader Vitest coverage for exam integrity, entitlements, admin gates, and payment fulfillment.
- [x] Run mobile visual QA at a mobile breakpoint.

- [x] Document and verify the Node.js application architecture, including Express runtime, ESM/TypeScript server entry, tRPC API boundary, and Stripe webhook route ordering.
- [x] Complete and type-check the interrupted protected-resource backend wiring after the Node.js alignment request.
- [x] Run Node.js build, tests, and preview verification, then save an updated checkpoint.

- [x] Fix the deployed /mock-exams route reported as broken and verify the repair against the live URL.

- [x] Use the supplied AFT logo URL as the single global logo source on the homepage, public navigation, exam shell, and admin surfaces.

- [x] Replace the current AFT light palette with the requested high-contrast dark violet, electric cyan, mint, white CTA, and lavender text system across public, learner, exam, and admin surfaces.

- [x] Add per-question objective-test answer review with correct/incorrect states and explanations after submission.
- [x] Replace hardcoded objective-test sample questions with typed data from stored backend question sets, with a safe empty state when none are published.
- [x] Re-run type checks/tests and capture desktop/mobile verification of the completed objective-test feedback flow.

- [x] Implement and register a qualification discovery page/route backed by tRPC, then verify it at desktop and mobile breakpoints.
- [x] Replace hardcoded dashboard cards, progress, membership/account details, and resume targets with data from typed student entitlement and attempt queries.
- [x] Expand dashboard live-data wiring so owned products, saved attempts, progress states, and resume actions reflect actual backend records, not placeholder values.

- [x] Remove the rounded background behind the global AFT logo and enlarge the logo across public, learner, exam, and admin headers.

- [x] Add explicit dashboard loading and error states for entitlement and attempt queries.
- [x] Wire dashboard product and saved-attempt cards to functional record-specific routes/actions.
- [x] Render distinct live views for Overview, My products, Saved attempts, and Results tabs.

- [x] Add record-specific learner route parameters so product and attempt actions open the intended backend record.
- [x] Make Overview and My products distinct live dashboard views.
- [x] Add unit coverage for dashboard tab/view and record-navigation helpers.

- [x] Read dashboard attempt/product query parameters and select the exact live record for the learner.
- [x] Add tests proving dashboard deep links resolve to the intended attempt or product record.

- [x] Auto-select the dashboard tab and highlight the exact attempt or product referenced by a deep link.
- [x] Add a pure selection helper test proving deep links choose the relevant dashboard view and record.

- [x] Add unit coverage for getDashboardSelectionState() proving deep links choose the relevant dashboard view and record.

- [x] Wire real protected files into exam resources, printable mode, feedback delivery, and course-resource actions.
- [x] Add admin management actions for mock exams, case-study sections, resources, and objective questions.
- [x] Replace prompt-based marking release with a structured rubric and scoring workflow.
- [x] Add procedure-level coverage for autosave validation, duplicate submission locking, protected downloads, admin gates, and notification events.

- [x] Resolve exam and resource delivery from selected exam/product records rather than hardcoded IDs.
- [x] Add a management action for case-study section records.
- [x] Persist rubric criteria and connect rubric rows to marking release scores.
- [x] Add procedure-level test seams for autosave, locking, downloads, admin gates, and notifications.

- [x] Pass selected mock-exam and product identifiers from chooser through debrief and mode routes.
- [x] Add persisted rubric criteria data and calculate release scores from rubric rows.
- [x] Add tests that exercise the actual tRPC procedure contracts for autosave, locked submission, downloads, admin denial, and notifications.

- [x] Review and classify the six user-supplied mock-exam files for case-study structure, sections, timing, instructions, and resource requirements.
- [x] Map the reviewed mock-exam records into the LMS catalogue and protected resource model without fabricating exam content.
- [x] Import approved source files as entitlement-protected resources and connect them to the selected mock exams.
- [x] Validate learner exam-mode, resource download, dashboard, and admin content-management flows with the imported records.

- [x] Replace the invalid catalogue QA route with the portal’s actual discovery route and verify it after sample import.
- [x] Make imported mock-exam debrief and mode copy reflect the selected record’s title, duration, sections, and protected resources.

- [x] Query the selected mock exam’s case-study sections on debrief and mode screens.
- [x] Render section-specific titles, counts, timings, and imported weighting/instruction metadata for every supplied mock exam.
- [x] Verify debrief and mode content changes across Cartn Mock Exam 3, Cartn Mock Exam 4, and Mock B.

- [x] Show an explicit published-section count on selected mock-exam debrief and mode screens.
- [x] Add loading, empty, and error states for selected mock-exam section metadata.
- [x] Capture and document mode-screen QA for Cartn Mock Exam 3, Cartn Mock Exam 4, and Mock B.

- [x] Query and document the exact mockExamId/productId values for Cartn Mock Exam 3, Cartn Mock Exam 4, and CIMA MCS Mock B after import.
- [x] Re-capture and document mode-screen QA using the confirmed imported exam URLs for all three supplied exams.

- [x] Allow imported free mock-exam products to access their protected resources without a paid entitlement while preserving paid-product enforcement.
- [ ] Run authenticated learner QA for imported exam start and printable/feedback resource downloads.
- [ ] Run authenticated admin QA confirming imported products, sections, and resources are visible in management panels.
- [x] Document the authenticated sample-import QA paths and outcomes.

- [x] Review the supplied mock-exam store reference and extract its layout, hierarchy, product-card, filter, and CTA patterns.
- [x] Remove Courses from all public navigation, homepage/store copy, and discovery routes used by learners.
- [x] Build a mock-exam-only store with live imported exam products, qualification/filter context, product detail entry points, and safe purchase actions.
- [x] Validate the store at desktop and mobile widths, including imported exam selection and checkout gating.

- [x] Add a server-side branded printable PDF generator using the selected exam title, AFT logo, sections, timings, instructions, and question/resource metadata.
- [x] Store generated PDFs in managed storage and expose them through entitlement-checked protected resource delivery.
- [x] Link Printable Exam mode directly to the generated PDF resource, with a clear unavailable state when no PDF exists.
- [x] Add an admin generation action for newly created or imported mock exams and ensure regeneration is idempotent.
- [x] Validate generated PDF metadata, logo presence, protected URL delivery, and printable-mode routing with tests and visual inspection.

- [x] Add a post-completion Online mock with solutions route for the selected attempt.
- [x] Gate illustrative solutions until the learner has completed the selected mock exam.
- [x] Add clearly labelled AFT-created illustrative task solutions based on the selected exam sections.
- [x] Fix mock-exam store TypeScript errors and validate the complete chooser, mode, completion, and solutions flow.

- [x] Fix the 30-second Section 1 introduction countdown and automatically start the first question when it reaches zero.
- [x] Preserve selected mock-exam/product parameters and validate the intro-to-question transition at desktop and mobile widths.

- [x] Pass the exact attempt identifier through mode, submission, and solutions routes.
- [x] Validate that the solutions attempt belongs to the selected mock exam and product before unlocking content.
- [x] Replace the shared generic solution copy with exam/section-specific AFT illustrative solution records derived from imported section metadata.
- [x] QA the chooser-to-attempt-to-submission-to-solutions flow, including no-attempt and wrong-attempt cases.

- [x] Keep the Pre-seen, Formulae + tables, and Calculator utility group visible from debrief through instructions, intro, question, and submission screens.
- [x] Add a functional exam calculator with keyboard-safe numeric operations, clear, backspace, and error handling.
- [x] Connect Formulae + tables to the imported protected resource and show a safe unavailable state when the file is missing.
- [x] Add clearly labelled AFT-created illustrative pre-seen content based on the selected imported exam brief without presenting it as an official source.
- [x] Validate the persistent utility layout and calculator across the selected debrief URL and downstream exam screens at desktop and mobile widths.

- [x] Match the case-study question screen to the supplied reference with the utility menu above the exam header and timer at the top right.
- [x] Place Reference material on the left and Email attachment on the right above the question and instructions.
- [x] Center the question and instructions above the aligned rich-text answer pad with the existing autosave and submission controls preserved.
- [x] Validate the exact question URL at desktop and mobile widths and cover the updated layout with tests where practical.
- [x] Move the case-study utility menu above the exam header/title area on question screens, then re-verify the exact question URL at desktop and mobile widths.
- [x] Add explicit qualification context to the mock-exam store UI through qualification labels or grouped qualification sections.
- [ ] Interactively validate mock-exam selection and auth/checkout gating on desktop and mobile, then document exact paths and outcomes.
- [x] Embed the official AFT logo in generated printable PDFs and include question/resource metadata, instructions, and section details.
- [x] Update Printable Exam mode to resolve generated printable_pdf resources for the selected exam/product and show an explicit unavailable state when absent.
- [x] Refine the exam utility controls into compact reference-style buttons with intentional spacing from the content below.
- [x] Make the utility group close or collapse cleanly when the learner scrolls down, without awkward viewport attachment.
- [x] Validate the refined utility controls at desktop and mobile widths and preserve calculator/resource interactions.
- [x] Keep Pre-seen, Formulae + tables, and Calculator in one header row beside the exam-shell logo.
- [x] Remove the duplicate Calculator action from the second row and keep Help and End session below the timer.
- [x] Validate the final exam-shell header arrangement at desktop and mobile widths.
- [x] Keep the exam-shell logo and the three study utilities on the same horizontal row at mobile width, using controlled horizontal overflow rather than stacking.
- [x] Re-run exact question-route desktop/mobile QA after the mobile same-line header correction.
- [x] Make public debrief Pre-seen, Formulae + tables, and Calculator controls a normal horizontal row, not sticky.
- [x] Allow an intro attempt to start before the 30-second cooldown ends while preserving automatic question start at zero.
- [x] Place question-screen Pre-seen, Formulae + tables, and Calculator on the opposite side requested by the reference.
- [x] Prevent saving or resuming an attempt after submission, regardless of remaining time.
- [x] Add tests and exact-route desktop/mobile QA for these exam-flow corrections.
- [x] Align the question-screen study utility group on the opposite side beside the logo to match the supplied reference.
- [x] Validate the exact question route at desktop and mobile widths after repositioning the utility group.
- [x] Add an exact-route regression check proving submitted or awaiting-marking attempts cannot resume or autosave from a question URL.
- [x] Re-run and document desktop/mobile QA for the locked-attempt question route.
- [x] Add a procedure-level regression that exercises saveAnswer with a submitted or awaiting-marking attempt and proves it is rejected.
- [x] Keep the locked-attempt browser QA limitation explicitly documented until an authenticated replay is available.
- [x] Add balanced vertical padding between the public header and the horizontal exam utility row on the selected debrief page, preserving normal flow and responsive usability.

- [x] Add an additive Mock exams submenu with Objective tests and Case study entries, keeping the existing case-study store route unchanged.
- [x] Translate the studied CIMA-style objective-test configuration, topic selection, question navigation, timer, answer review, and feedback patterns into the AFT design system.
- [x] Add PayFast checkout integration planning with test/live gateway selection restricted to admin controls and server-side verification.
- [x] Ensure the Mock exams dropdown labels the two destinations clearly as Case study and Objective test, linking to /mock-exams and /objective-tests respectively without changing the existing theme.
- [x] Add a PayFast checkout configuration surface that defaults to sandbox, keeps blank credentials disabled, and restricts gateway mode changes to admins.
- [x] Add a server-side PayFast checkout form/ITN verification path that fails closed until credentials are configured.
- [x] Add objective-test assessment-hub and question-workspace regression coverage, including empty-state and configurable-set behavior.
- [x] Move exam-type dropdown into the global Mock exams header menu; keep direct Mock exams click opening the full catalogue and remove the misplaced duplicate dropdown.
- [x] Research public CIMA blueprint and question-format guidance and document the source boundaries for AFT-created objective-test content.
- [x] Add three clearly labelled AFT-created objective-test sets with original practice questions and purchasable store products.
- [x] Make exam entitlements expire after an admin-controlled access period, defaulting to 30 days for new exam products and enforcing expiry server-side.
- [x] Add a purchasable instructor-marking product and gate Send for marking behind an active marking entitlement, with a disabled state when unavailable.
- [x] Expand the admin console for exam/product/question/resource uploads, publishing, subscription settings, marking products, users, and site administration.
- [x] Add tests and visual QA for objective-test product purchase visibility, entitlement expiry, marking lock states, and admin workflows.
- [x] Make the three current objective-test products free and add an admin-controlled free/paid product setting.
- [x] Replace direct store payment actions with a learner cart and PayFast cart checkout, including free-product enrollment.
- [x] Show purchased subscription status and accurate days remaining in the learner account.
- [x] Add tests and responsive QA for free/paid controls, cart behavior, checkout payloads, and subscription countdowns.
- [x] Add an objective-test course overview page with course summary, Test Yourself Extra, and Mock Exam D entry points.
- [x] Add Test Yourself Extra instructions and configurable question-count/topic customization flow.
- [x] Add objective-test instructions and welcome screens before assessment start.
- [x] Add a full-screen objective-test question workspace with timed navigation, answer state, flagging, scratch pad, and completion feedback.
- [x] Add route, state, scoring, responsive QA, and reference-boundary tests for the staged objective-test journey.
- [x] Rename the three objective-test products using the requested CIMAStudy-style course names and categories.
- [x] Add original AFT featured images to every store product and render them in catalogue cards.
- [x] Add an admin featured-image upload field to product/exam creation and persist the selected asset.
- [x] Validate renamed products, featured-image rendering, admin image workflow, responsive layout, and regression tests.
- [x] Remove Pre-seen, Formulae + tables, and Calculator controls from Objective test screens while preserving them for Case Study exams.
- [x] Route Objective test products away from `/case-study/mode` into the objective-test course/customization journey.
- [x] Remove Case Study section metadata and mode cards from Objective test access while preserving Case Study routes.
- [x] Add regression coverage for objective deep links and Case Study route separation.
- [ ] Create an isolated, clearly labelled demo learner account with all current Case Study and Objective test products attached.
- [ ] Set the demo account entitlements to expire after 60 days and show the expiry in the learner account.
- [ ] Add safe provisioning tests and validate the demo account without affecting real learners.
- [x] Change current exam products to paid and show Start exam instead of Add to cart for genuinely free products.
- [ ] Provision the isolated demo learner with all current Case Study and Objective test products for 60 days and verify the entitlement set.
- [x] Hide correctness, score, percentage, explanations, and result controls until Objective test submission is complete.
- [x] Remove the in-exam Scratch pad panel and expand the question/answer workspace.
- [x] Add End Assessment, Flag, Navigation, Back, and Next controls to the Objective test pad.
- [x] Support instructor-configured objective question types including multiple choice, selection, text input, and dropdown.
- [x] Add admin question attachment support for PNG/JPEG and other useful image formats, with safe managed storage.
- [x] Add tests and responsive QA proving no feedback leaks during an attempt and correct post-submit review behavior.
- [x] Expand each seeded Objective test exam to a large original AFT question bank with hundreds of questions distributed across topics and supported formats.
- [x] Validate expanded question counts, topic distribution, format coverage, and scoring behavior.
- [x] Remove the long numbered question list from beneath the Objective test answer area while retaining essential compact controls.
- [x] Keep the large Objective question bank separate from each attempt and cap active tests to selected 20- or 60-question sets.
- [x] Validate selected-count behavior and update Objective test copy to explain bank-versus-attempt sizing.
- [x] Update Objective test copy and controls so instructors populate large subject banks while students choose subject areas and 20- or 60-question attempt size.
- [x] Replace fixed “Mock Exam D” wording with the selected mock or objective-test title throughout the Objective test journey.
- [x] Remove the complete Objective test Scratch pad/Working notes panel, including its heading and supporting copy.
- [x] Remove the long numbered question list beneath the Objective test answer area so the exam pad remains clean and spacious.

- [x] Rework the Objective test workspace to match the supplied reference image at the question, timer, answer-choice, flag, navigation, and end-assessment layout level while preserving AFT branding and active-attempt behavior.
- [x] Capture desktop/mobile QA and regression-test the revised Objective workspace without exposing correctness feedback during an active attempt.

- [ ] Add a temporary, clearly labelled QA/demo learner access mode that bypasses only learner login for controlled testing while preserving admin authorization, PayFast verification, protected-resource safeguards, and production user security.
- [ ] Add tests proving QA/demo access is isolated, non-admin, and cannot grant or alter real learner entitlements.
- [ ] Verify the temporary QA learner journey and document how to disable or roll back the mode.

- [x] Minimize and center the product-specific Objective test panel at productId 30003 while preserving its CIMA-style hierarchy and controls.
- [x] Adapt the product-specific Objective panel colors to the established AFT dark-violet, cyan, mint, lavender, and white-CTA palette.
- [x] Verify the product-specific Objective panel at desktop and mobile widths and publish the refinement.

- [x] Temporarily make all published case-study and Objective test products free to start, showing Start exam instead of payment/cart actions while preserving PayFast and admin pricing controls for later use.
- [x] Verify free enrollment, catalogue labels, and regression coverage for the temporary free-access configuration.

- [x] Make `npm run dev` start the development server and open the local AFT portal in the default browser, with a server-only fallback for headless environments.
- [x] Validate the launcher script and document local ZIP usage for the next developer.

- [x] Resize the Objective test exam pad from full-screen treatment to a centered, narrower canvas while preserving question, timer, answer, and navigation controls.
- [x] Verify the compact Objective exam pad at desktop and mobile widths and document the result.

- [x] Package the latest AFT LMS source into a verified ZIP that opens the local portal automatically with `npm run dev`.

- [x] Reduce the Objective exam-pad vertical height so the contained pad occupies the middle of the screen without excessive empty space.
- [x] Replace the Objective exam-pad #0877bd accent with #18093c and adjust supporting text, borders, and hover states for contrast.
- [x] Verify the revised exam pad at desktop and mobile widths and publish the update.

- [x] Fix the exact Objective route `/objective-tests?mockExamId=30003&productId=30003` so it cannot render the old full-screen exam-pad layout after the latest styling update.
- [x] Verify the exact route after a fresh publish and document the cache/deployment result.

- [x] Fix Windows PowerShell `spawn EINVAL` in `scripts/dev-launcher.mjs` so `npm run dev` starts and opens the browser cross-platform.
- [x] Add regression coverage/documentation for Windows, macOS, Linux, and headless launcher behavior, then package a corrected ZIP.
