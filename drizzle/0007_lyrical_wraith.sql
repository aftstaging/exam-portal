ALTER TABLE `objectiveQuestions` MODIFY COLUMN `questionType` enum('single_choice','multiple_choice','dropdown','numerical','text_input') NOT NULL;--> statement-breakpoint
ALTER TABLE `objectiveQuestions` ADD `attachmentUrl` text;--> statement-breakpoint
ALTER TABLE `objectiveQuestions` ADD `attachmentFileName` varchar(240);--> statement-breakpoint
ALTER TABLE `objectiveQuestions` ADD `attachmentMimeType` varchar(120);