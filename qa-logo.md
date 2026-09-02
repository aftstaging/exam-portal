# Logo QA findings

The shared AFT logo was checked at 1280x720 and 375x812 across `/`, `/dashboard`, `/admin`, `/case-study/question`, and `/courses`. The logo now renders without the rounded dark wrapper and uses the enlarged `h-10` treatment in the public header, exam top bar, admin sidebar, and catalogue header. The mobile views remain legible: public navigation collapses while the logo and CTA remain visible, and the exam top bar retains the logo without crowding the utility actions.

The dashboard and admin screenshots also confirmed that the logo is present in learner and administrative surfaces. The objective-test/catalogue header uses the shared `PortalHeader` implementation and now matches the treatment.

## Live-data dashboard QA

The dashboard now renders an empty-but-actionable learner state when the signed-in account has no active entitlements or attempts, rather than showing fabricated membership or progress. The admin overview now renders live counts (one signed-in account and zero pending records in the current environment) and an explicit empty audit state. Desktop and mobile layouts remain readable, and the admin cards stack cleanly at 375px.

## Final responsive QA

The final desktop and mobile captures show the new background-free, enlarged logo consistently across the public shared header, learner dashboard, and catalogue pages. Live empty states are clear at both breakpoints: the learner sees an actionable browse path, the admin sees live counts and an audit-log empty state, and catalogue/objective-test pages explain when records will become available. Paid catalogue cards now have a typed `Get access` action that signs in first and then opens the server-created Stripe Checkout session.

## Exact-route and tab QA

Final desktop and mobile captures remained stable after adding exact attempt/product query parameters and extracting dashboard view/navigation helpers. The default Overview view continues to present live summary counts, while My products, Saved attempts, and Results are routed through separate render branches. Unit tests cover each tab mapping and verify that attempt IDs are preserved in resume and record routes.

## Final operational QA — 2026-08-26

The desktop dashboard presents the enlarged background-free AFT logo cleanly in the public header, with live empty states for entitlements and attempts. The admin console shows the dark-violet sidebar, live learner/marking/catalogue metrics, and the new content inventory counts for products, mock exams, sections, resources, and questions. The exam workspace keeps the enlarged logo visible beside Calculator, Help, End session, and the persistent Pre-seen, Formulae + tables, and Calculator controls. The available screenshot data was an empty-state/admin preview, so record-specific resource downloads and structured marking forms still require authenticated manual interaction to exercise.

The latest 375px capture confirms the learner hero and admin metric cards stack cleanly, while the exam workspace keeps the enlarged logo and resource controls readable without horizontal overflow. The admin content inventory remains legible on narrow screens. Structured marking and secure resource download actions were validated by type checks and tests; authenticated populated-record interaction remains the next manual verification step.

## Release QA — final hardening

The live mock-exam chooser now resolves published records and passes `mockExamId` and `productId` through the debrief and mode routes. The admin console exposes a dedicated Sections panel with audited rename actions, and marker release captures four scored rubric criteria in the persisted marking snapshot. The responsive desktop surfaces remain stable after these changes; empty catalogue and learner states remain explicit rather than fabricated.

## Section 1 timer QA

The local `/case-study/intro?mockExamId=1&productId=1` route renders the selected exam shell, a visible `00:30` countdown, a disabled action labelled “Exam starts automatically in 00:30,” and the Section 1 introduction content. The route preserves the selected mock-exam and product query parameters.

## Online mock with solutions QA

The mobile mode screen now presents “Online mock with solutions” as a distinct option and explains that AFT-created illustrative solutions unlock after completion. Opening `/case-study/solutions?mockExamId=1&productId=1` without a learner-owned completed attempt shows a clear locked state and return action. The copy explicitly separates these practice explanations from official answers and awarded marks. The completion path is backed by the real submission mutation and then routes to the solutions screen using the stored attempt identifier.

## Exact-attempt Online solutions QA

The Online mock with solutions route now reads only the explicit `attempt`, `mockExamId`, and `productId` query parameters. Without an attempt, the route shows a locked state; a non-existent attempt also remains locked. A real submission writes the attempt status through the protected server mutation, preserves the attempt identifier, and then opens the selected exam’s solution route. The illustrative cards are generated from the selected exam’s live section title and brief, with each card explicitly labelled as AFT-created and not official.
