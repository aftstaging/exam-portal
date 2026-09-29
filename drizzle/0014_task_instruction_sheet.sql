-- Per-task instruction sheets: a PNG, JPEG or PDF that accompanies a case-study task's
-- instructions. Stored as a `resources` row tagged with the owning `sectionNumber`, exactly
-- like the existing per-task `email` and `reference` attachments.
ALTER TABLE `resources` MODIFY COLUMN `kind` ENUM('pre_seen','formulae','printable_pdf','feedback','course_material','reference','email','instructions') NOT NULL;
