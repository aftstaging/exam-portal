-- User-supplied sample mock-exam catalogue import.
-- Source PDFs are stored in private managed storage; only metadata and protected file keys are persisted here.

INSERT INTO `products` (`qualificationId`, `title`, `category`, `description`, `priceCents`, `accessDays`, `status`)
SELECT NULL, 'Cartn Mock Exam 3', 'case_study', 'CIMA Management Case Study mock exam based on the supplied Cartn Mock Exam 3 question and suggested-solutions PDFs.', 0, 365, 'published'
WHERE NOT EXISTS (SELECT 1 FROM `products` WHERE `title` = 'Cartn Mock Exam 3' AND `category` = 'case_study');

INSERT INTO `products` (`qualificationId`, `title`, `category`, `description`, `priceCents`, `accessDays`, `status`)
SELECT NULL, 'Cartn Mock Exam 4', 'case_study', 'CIMA Management Case Study mock exam based on the supplied Cartn Mock Exam 4 question and suggested-solutions PDFs.', 0, 365, 'published'
WHERE NOT EXISTS (SELECT 1 FROM `products` WHERE `title` = 'Cartn Mock Exam 4' AND `category` = 'case_study');

INSERT INTO `products` (`qualificationId`, `title`, `category`, `description`, `priceCents`, `accessDays`, `status`)
SELECT NULL, 'CIMA MCS Mock B — May & August 2026', 'case_study', 'Management-level homework mock based on the supplied May & August 2026 question paper and answers with marking guide.', 0, 365, 'published'
WHERE NOT EXISTS (SELECT 1 FROM `products` WHERE `title` = 'CIMA MCS Mock B — May & August 2026' AND `category` = 'case_study');

SET @p3 = (SELECT `id` FROM `products` WHERE `title` = 'Cartn Mock Exam 3' AND `category` = 'case_study' LIMIT 1);
SET @p4 = (SELECT `id` FROM `products` WHERE `title` = 'Cartn Mock Exam 4' AND `category` = 'case_study' LIMIT 1);
SET @pb = (SELECT `id` FROM `products` WHERE `title` = 'CIMA MCS Mock B — May & August 2026' AND `category` = 'case_study' LIMIT 1);

INSERT INTO `mockExams` (`productId`, `title`, `examType`, `intro`, `totalDurationSeconds`, `status`)
SELECT @p3, 'Cartn Mock Exam 3', 'case_study', 'Four 45-minute unseen tasks. Use the supplied question paper for the full case material and the separately protected guide for post-submission review.', 10800, 'published'
WHERE NOT EXISTS (SELECT 1 FROM `mockExams` WHERE `title` = 'Cartn Mock Exam 3');

INSERT INTO `mockExams` (`productId`, `title`, `examType`, `intro`, `totalDurationSeconds`, `status`)
SELECT @p4, 'Cartn Mock Exam 4', 'case_study', 'Four 45-minute unseen tasks. Use the supplied question paper for the full case material and the separately protected guide for post-submission review.', 10800, 'published'
WHERE NOT EXISTS (SELECT 1 FROM `mockExams` WHERE `title` = 'Cartn Mock Exam 4');

INSERT INTO `mockExams` (`productId`, `title`, `examType`, `intro`, `totalDurationSeconds`, `status`)
SELECT @pb, 'CIMA MCS Mock B — May & August 2026', 'case_study', 'Management-level homework mock with four 45-minute tasks, one answer screen per task, and a separately protected answers and marking guide.', 10800, 'published'
WHERE NOT EXISTS (SELECT 1 FROM `mockExams` WHERE `title` = 'CIMA MCS Mock B — May & August 2026');

SET @m3 = (SELECT `id` FROM `mockExams` WHERE `title` = 'Cartn Mock Exam 3' LIMIT 1);
SET @m4 = (SELECT `id` FROM `mockExams` WHERE `title` = 'Cartn Mock Exam 4' LIMIT 1);
SET @mb = (SELECT `id` FROM `mockExams` WHERE `title` = 'CIMA MCS Mock B — May & August 2026' LIMIT 1);

INSERT INTO `caseStudySections` (`mockExamId`, `sectionNumber`, `title`, `introduction`, `scenario`, `question`, `durationSeconds`, `cooldownSeconds`)
SELECT @m3, 1, 'Task 1 — Risks and negotiations', '45 minutes. Sub-task weighting: risks 60%; negotiations 40%. Refer to the protected question paper for complete case wording.', NULL, NULL, 2700, 30
WHERE NOT EXISTS (SELECT 1 FROM `caseStudySections` WHERE `mockExamId` = @m3 AND `sectionNumber` = 1);
INSERT INTO `caseStudySections` (`mockExamId`, `sectionNumber`, `title`, `introduction`, `scenario`, `question`, `durationSeconds`, `cooldownSeconds`)
SELECT @m3, 2, 'Task 2 — Disruptive technology', '45 minutes. Refer to the protected question paper for complete case wording.', NULL, NULL, 2700, 30
WHERE NOT EXISTS (SELECT 1 FROM `caseStudySections` WHERE `mockExamId` = @m3 AND `sectionNumber` = 2);
INSERT INTO `caseStudySections` (`mockExamId`, `sectionNumber`, `title`, `introduction`, `scenario`, `question`, `durationSeconds`, `cooldownSeconds`)
SELECT @m3, 3, 'Task 3 — Sources of funding and ratio analysis', '45 minutes. Sub-task weighting: sources of funding 60%; ratio analysis 40%. Refer to the protected question paper for complete case wording.', NULL, NULL, 2700, 30
WHERE NOT EXISTS (SELECT 1 FROM `caseStudySections` WHERE `mockExamId` = @m3 AND `sectionNumber` = 3);
INSERT INTO `caseStudySections` (`mockExamId`, `sectionNumber`, `title`, `introduction`, `scenario`, `question`, `durationSeconds`, `cooldownSeconds`)
SELECT @m3, 4, 'Task 4 — Pricing and communication', '45 minutes. Sub-task weighting: pricing 40%; communication 60%. Refer to the protected question paper for complete case wording.', NULL, NULL, 2700, 30
WHERE NOT EXISTS (SELECT 1 FROM `caseStudySections` WHERE `mockExamId` = @m3 AND `sectionNumber` = 4);

INSERT INTO `caseStudySections` (`mockExamId`, `sectionNumber`, `title`, `introduction`, `scenario`, `question`, `durationSeconds`, `cooldownSeconds`)
SELECT @m4, 1, 'Task 1 — Digital data sources and value management', '45 minutes. Sub-task weighting: digital data sources 40%; value management techniques 60%. Refer to the protected question paper for complete case wording.', NULL, NULL, 2700, 30
WHERE NOT EXISTS (SELECT 1 FROM `caseStudySections` WHERE `mockExamId` = @m4 AND `sectionNumber` = 1);
INSERT INTO `caseStudySections` (`mockExamId`, `sectionNumber`, `title`, `introduction`, `scenario`, `question`, `durationSeconds`, `cooldownSeconds`)
SELECT @m4, 2, 'Task 2 — Business models and stakeholder management', '45 minutes. Sub-task weighting: business models 60%; managing stakeholders 40%. Refer to the protected question paper for complete case wording.', NULL, NULL, 2700, 30
WHERE NOT EXISTS (SELECT 1 FROM `caseStudySections` WHERE `mockExamId` = @m4 AND `sectionNumber` = 2);
INSERT INTO `caseStudySections` (`mockExamId`, `sectionNumber`, `title`, `introduction`, `scenario`, `question`, `durationSeconds`, `cooldownSeconds`)
SELECT @m4, 3, 'Task 3 — Risk evaluation and project management', '45 minutes. Sub-task weighting: risk evaluation techniques 40%; project management tools 60%. Refer to the protected question paper for complete case wording.', NULL, NULL, 2700, 30
WHERE NOT EXISTS (SELECT 1 FROM `caseStudySections` WHERE `mockExamId` = @m4 AND `sectionNumber` = 3);
INSERT INTO `caseStudySections` (`mockExamId`, `sectionNumber`, `title`, `introduction`, `scenario`, `question`, `durationSeconds`, `cooldownSeconds`)
SELECT @m4, 4, 'Task 4 — Accounting treatment and stakeholders', '45 minutes. Sub-task weighting: accounting treatment 60%; stakeholder management 40%. Refer to the protected question paper for complete case wording.', NULL, NULL, 2700, 30
WHERE NOT EXISTS (SELECT 1 FROM `caseStudySections` WHERE `mockExamId` = @m4 AND `sectionNumber` = 4);

INSERT INTO `caseStudySections` (`mockExamId`, `sectionNumber`, `title`, `introduction`, `scenario`, `question`, `durationSeconds`, `cooldownSeconds`)
SELECT @mb, 1, 'Task 1 — Mock B', '45 minutes. Two sub-tasks weighted 60% and 40%. Refer to the protected May & August 2026 question paper for complete case wording.', NULL, NULL, 2700, 30
WHERE NOT EXISTS (SELECT 1 FROM `caseStudySections` WHERE `mockExamId` = @mb AND `sectionNumber` = 1);
INSERT INTO `caseStudySections` (`mockExamId`, `sectionNumber`, `title`, `introduction`, `scenario`, `question`, `durationSeconds`, `cooldownSeconds`)
SELECT @mb, 2, 'Task 2 — Mock B', '45 minutes. Two sub-tasks weighted 60% and 40%. Refer to the protected May & August 2026 question paper for complete case wording.', NULL, NULL, 2700, 30
WHERE NOT EXISTS (SELECT 1 FROM `caseStudySections` WHERE `mockExamId` = @mb AND `sectionNumber` = 2);
INSERT INTO `caseStudySections` (`mockExamId`, `sectionNumber`, `title`, `introduction`, `scenario`, `question`, `durationSeconds`, `cooldownSeconds`)
SELECT @mb, 3, 'Task 3 — Mock B', '45 minutes. Two sub-tasks weighted 40% and 60%. Refer to the protected May & August 2026 question paper for complete case wording.', NULL, NULL, 2700, 30
WHERE NOT EXISTS (SELECT 1 FROM `caseStudySections` WHERE `mockExamId` = @mb AND `sectionNumber` = 3);
INSERT INTO `caseStudySections` (`mockExamId`, `sectionNumber`, `title`, `introduction`, `scenario`, `question`, `durationSeconds`, `cooldownSeconds`)
SELECT @mb, 4, 'Task 4 — Mock B', '45 minutes. Three sub-tasks weighted 33%, 34%, and 33%. Refer to the protected May & August 2026 question paper for complete case wording.', NULL, NULL, 2700, 30
WHERE NOT EXISTS (SELECT 1 FROM `caseStudySections` WHERE `mockExamId` = @mb AND `sectionNumber` = 4);

INSERT INTO `resources` (`productId`, `title`, `kind`, `fileKey`, `fileUrl`, `status`)
SELECT @p3, 'Cartn Mock Exam 3 — Question paper', 'printable_pdf', '/manus-storage/cartn-mock-3-questions_86b5bfd2.pdf', '/manus-storage/cartn-mock-3-questions_86b5bfd2.pdf', 'published'
WHERE NOT EXISTS (SELECT 1 FROM `resources` WHERE `title` = 'Cartn Mock Exam 3 — Question paper');
INSERT INTO `resources` (`productId`, `title`, `kind`, `fileKey`, `fileUrl`, `status`)
SELECT @p3, 'Cartn Mock Exam 3 — Suggested solutions', 'feedback', '/manus-storage/cartn-mock-3-solutions_32e82a35.pdf', '/manus-storage/cartn-mock-3-solutions_32e82a35.pdf', 'published'
WHERE NOT EXISTS (SELECT 1 FROM `resources` WHERE `title` = 'Cartn Mock Exam 3 — Suggested solutions');
INSERT INTO `resources` (`productId`, `title`, `kind`, `fileKey`, `fileUrl`, `status`)
SELECT @p4, 'Cartn Mock Exam 4 — Question paper', 'printable_pdf', '/manus-storage/cartn-mock-4-questions_2482578c.pdf', '/manus-storage/cartn-mock-4-questions_2482578c.pdf', 'published'
WHERE NOT EXISTS (SELECT 1 FROM `resources` WHERE `title` = 'Cartn Mock Exam 4 — Question paper');
INSERT INTO `resources` (`productId`, `title`, `kind`, `fileKey`, `fileUrl`, `status`)
SELECT @p4, 'Cartn Mock Exam 4 — Suggested solutions', 'feedback', '/manus-storage/cartn-mock-4-solutions_fd3050f1.pdf', '/manus-storage/cartn-mock-4-solutions_fd3050f1.pdf', 'published'
WHERE NOT EXISTS (SELECT 1 FROM `resources` WHERE `title` = 'Cartn Mock Exam 4 — Suggested solutions');
INSERT INTO `resources` (`productId`, `title`, `kind`, `fileKey`, `fileUrl`, `status`)
SELECT @pb, 'Mock B — May & August 2026 question paper', 'printable_pdf', '/manus-storage/cima-mock-b-questions_3d75099e.pdf', '/manus-storage/cima-mock-b-questions_3d75099e.pdf', 'published'
WHERE NOT EXISTS (SELECT 1 FROM `resources` WHERE `title` = 'Mock B — May & August 2026 question paper');
INSERT INTO `resources` (`productId`, `title`, `kind`, `fileKey`, `fileUrl`, `status`)
SELECT @pb, 'Mock B — Answers and marking guide', 'feedback', '/manus-storage/cima-mock-b-answers-marking-guide_9a4a66dc.pdf', '/manus-storage/cima-mock-b-answers-marking-guide_9a4a66dc.pdf', 'published'
WHERE NOT EXISTS (SELECT 1 FROM `resources` WHERE `title` = 'Mock B — Answers and marking guide');
