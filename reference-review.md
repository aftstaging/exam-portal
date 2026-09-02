# Supplied mock-exam reference review

## Files reviewed

| File | Drive title | Initial evidence |
| --- | --- | --- |
| 1 | Astranti Cartn mock 3 questions - 30.07.2026.pdf | Four-page PDF viewer; cover identifies Management Case Study, Mock Exam 3, Cartn, Unseen [3 hours]. |
| 2 | Astranti Cartn mock 3 solutions - 30.07.2026.pdf | Four-page PDF viewer; cover identifies Management Case Study, Mock Exam 3, Cartn, Suggested Solutions. |

## Structural observations

The source set includes a question/unseen document and a matching suggested-solutions document for the same Cartn Mock Exam 3. The first page uses a document-style cover with a top-right exam label and centered exam title. The question cover explicitly shows an unseen three-hour component, while the solutions cover is separately labelled Suggested Solutions. Further page-level details remain to be reviewed from the remaining supplied files.

| 3 | Astranti mock 4 questions - Cartn.pdf | Four-page PDF viewer; cover identifies Management Case Study, Mock Exam 4, Cartn, Unseen [3 hours]. |
| 4 | Astranti mock 4 solutions - Cartn.pdf | Four-page PDF viewer; cover identifies Management Case Study, Mock Exam 4, Cartn, Suggested Solutions. |

The second pair repeats the same source pattern as the first pair: a three-hour unseen question paper paired with a separately labelled suggested-solutions paper. The shared Cartn case context and Mock Exam 3/4 numbering should become distinct selectable records, not one merged product.

| 5 | CIMA MCS Mock B (homework mock) - Answers May & August 2026 with marking guide.pdf | Four-page PDF viewer; cover identifies CIMA Management Case Study, May & August 2026, Mock Exam B, Answers, and warns learners not to consult answers until submission. |
| 6 | CIMA MCS Mock B (homework mock) - Questions May & August 2026.pdf | Google Drive PDF viewer; title identifies the matching Mock B question paper for May & August 2026. The viewer was still loading the page body, so page-level question details could not be confirmed from the public viewer. |

## Import classification

| Record group | Question/source file | Solution/marking file | Portal treatment |
| --- | --- | --- | --- |
| Cartn Mock Exam 3 | File 1 | File 2 | One selectable case-study mock with separate protected questions and solutions resources. |
| Cartn Mock Exam 4 | File 3 | File 4 | One selectable case-study mock with separate protected questions and solutions resources. |
| CIMA MCS Mock B, May & August 2026 | File 6 | File 5 | One homework-style case-study mock with protected questions, answers, and marking-guide resource; keep answer access locked until submission/entitlement rules permit it. |

The six files are direct Google Drive references. The content is accessible in the viewer, but source PDFs should be downloaded or uploaded by the user or an authorised project operator before bytes are imported into S3-backed protected resources. No question text has been fabricated from the incomplete viewer extraction.

## Deeper Mock B extraction

The Mock B questions PDF has 14 pages. Its first page specifies a Management-level case study for May & August 2026 with four sections, each allocated 45 minutes, one answer screen, and two sub-tasks. Sections 1 and 2 allocate 60%/40% between sub-tasks; Section 3 allocates 40%/60%; Section 4 allocates 33%/34%/33%. The early pages include formulae and tables, including annuity, perpetuity, growing perpetuity, present-value, and normal-curve references.

The matching answers and marking-guide PDF has 20 pages. Its cover explicitly warns learners not to consult the answers until they have completed and submitted the mock questions for marking. This supports a separate entitlement- and submission-gated solutions resource in the portal.

## Mock B page-level structure

The downloaded Mock B questions file confirms a 14-page paper: one opening structure page, three pages of formulae/tables, and the remaining pages containing the case-study questions. The paper is organized into four 45-minute tasks, each with one answer screen. Tasks 1 and 2 each have two sub-tasks weighted 60%/40%; Task 3 has two sub-tasks weighted 40%/60%; Task 4 has three sub-tasks weighted 33%/34%/33%.

The downloaded 20-page answers guide confirms matching Task 1 through Task 4 solution sections and marking guides. The guide allocates marks as follows: Task 1(a) 15 and 1(b) 10; Task 2(a) 15 and 2(b) 10; Task 3(a) 10 and 3(b) 15; Task 4(a) 8, 4(b) 9, and 4(c) 8. It therefore supports a structured rubric model with criterion rows, marks, descriptors, and post-submission solution access rather than a single free-text answer resource.

## Portal QA after import

The public `/mock-exams` chooser now shows Cartn Mock Exam 3, Cartn Mock Exam 4, and CIMA MCS Mock B — May & August 2026. The correct discovery route is `/courses`, not `/catalogue`; `/courses` renders all three imported records as published catalogue cards. The selected Mock B debrief and mode screens now show the live title, a 180-minute total, four 45-minute tasks, and protected question/solution resource descriptions instead of the previous generic Mock Exam 1 copy.

## Mobile mode QA

Mobile captures for Cartn Mock Exam 3, Cartn Mock Exam 4, and CIMA MCS Mock B each show the selected exam title, 180-minute timing, an explicit “4 published sections” summary, and exam-specific section titles and weighting/instruction text. The section cards stack cleanly within the narrow viewport; the remaining mode cards continue below the fold as expected.

## Confirmed imported IDs

The production database maps the supplied records as follows: Cartn Mock Exam 3 uses `mockExamId=1` and `productId=1`; Cartn Mock Exam 4 uses `mockExamId=2` and `productId=2`; CIMA MCS Mock B — May & August 2026 uses `mockExamId=3` and `productId=3. These are the exact URLs used for the mode-screen QA captures.

The confirmed-ID recapture shows the three mode screens resolve correctly: IDs 1/1 display Cartn Mock Exam 3 and its risks, negotiations, disruptive technology, funding, ratio, pricing, and communication metadata; IDs 2/2 display Cartn Mock Exam 4 and its digital data, value management, business model, stakeholder, risk, project, accounting, and communication metadata; IDs 3/3 display Mock B and its task weighting instructions. Each screen shows four published sections and the 180-minute configuration.

## Authenticated QA note

The published production URL correctly serves the public shell at `/dashboard` when no learner session is present, so protected learner/admin surfaces remain gated. The browser’s local preview session returned a blank page during this check and requires a preview refresh before interactive authenticated testing. The database import and public catalogue/debrief/mode QA are verified; protected download execution still needs a logged-in learner session in the Management UI.

## Post-refresh QA

After restarting the preview service, the corrected `/courses`, `/mock-exams`, and selected `/case-study/debrief?mockExamId=1&productId=1` routes rendered successfully. The catalogue showed all three imported products, the chooser showed all three mock exams, and the Cartn Mock Exam 3 debrief showed its four 45-minute sections with risks/negotiations, disruptive technology, funding/ratio analysis, and pricing/communication metadata. The published production URL remains correctly gated for unauthenticated `/dashboard` access.

## Resource access verification

Database verification confirms all three imported products are free (`priceCents=0`) and each has two published resources: one question paper and one suggested-solutions/marking-guide PDF. The server policy now allows free products to use the same protected signed-download procedures without requiring a paid entitlement, while paid products continue to require an active entitlement. A real authenticated browser session is still required to observe the learner download and admin panel flows end to end.

## Mock-exam store reference

The supplied store reference is an Asranti-style white storefront screenshot with a slim brand/navigation header, qualification links across the top, a centered page heading for “OCS mock exams & debrief videos,” a short explanatory paragraph, and grouped product rows. Products appear as compact mock-exam tiles with a title, a £22.50 price, and green “Add to basket” CTAs. A second group separates exams with debrief videos. A visible TeamViewer overlay is part of the reference capture rather than a desired portal feature and will not be reproduced.
