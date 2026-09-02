# AFT sample-import QA notes

The live public path `/mock-exams` was verified on 26 August 2026 at desktop and mobile widths. The public header shows Home, Mock exams, Study resources, and My Account; Courses is absent. The store displayed Cartn Mock Exam 3, Cartn Mock Exam 4, and CIMA MCS Mock B — May & August 2026 with case-study labels, qualification-aware catalogue copy, durations, protected-PDF labels, Details links, and Open actions.

The Open action for Cartn Mock Exam 4 was exercised from the live catalogue and navigated to `/case-study/debrief?mockExamId=2&productId=2`. The debrief showed the selected exam title, section plan, and persistent Pre-seen, Formulae + tables, and Calculator controls.

The current browser session is not authenticated: `/dashboard` resolves to the public home experience with Log in and Create account controls. Therefore authenticated learner resource-download QA and authenticated admin-panel QA cannot be honestly marked as executed in this session. The implementation remains covered by protected tRPC procedures, entitlement checks, and unit/procedure tests; a signed-in browser session is still required for end-to-end download and admin visibility confirmation.

## Latest session status

After the utility refinement checkpoint, the browser again redirected to the sign-in page when attempting to open the preview route. No learner or administrator credentials were supplied, so protected learner-start, signed-download, and admin visibility actions remain pending for a signed-in UAT session. The public imported-store selection path and Cartn Mock Exam 4 debrief path were previously exercised successfully.

## Exam-flow correction QA — 26 August 2026

The public debrief utilities are rendered as a normal horizontal in-flow row rather than a fixed or sticky rail. The intro flow now exposes an early Start exam action while retaining automatic transition when the countdown reaches zero. Submitted and awaiting-marking attempts remain non-editable in the server helper, the question UI disables Save, and dashboard routing sends those statuses to the review/dashboard path rather than a resumable question route.

The exact question URL was checked at desktop and mobile widths after the opposite-side utility alignment. The local preview does not provide an authenticated learner session for a true post-submission browser replay; the locked-attempt behavior is covered by `server/examFlow.test.ts`, `server/integrity.test.ts`, and the server-side save/submission guards. The current validation suite passes 28 tests.
