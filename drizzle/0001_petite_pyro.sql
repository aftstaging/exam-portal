CREATE TABLE `answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptId` int NOT NULL,
	`sectionId` int NOT NULL,
	`body` text NOT NULL,
	`wordCount` int NOT NULL DEFAULT 0,
	`savedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`mockExamId` int NOT NULL,
	`mode` enum('interactive','printable','solutions','feedback') NOT NULL,
	`status` enum('not_started','in_progress','submitted','awaiting_marking','marked','expired','cancelled') NOT NULL DEFAULT 'not_started',
	`currentSection` int NOT NULL DEFAULT 1,
	`startedAt` timestamp,
	`submittedAt` timestamp,
	`contentVersion` varchar(64) NOT NULL DEFAULT 'v1',
	`optOutOfMarking` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`entityType` varchar(80) NOT NULL,
	`entityId` int,
	`action` varchar(100) NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `auditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `caseStudySections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mockExamId` int NOT NULL,
	`sectionNumber` int NOT NULL,
	`title` varchar(240) NOT NULL,
	`introduction` text,
	`scenario` text,
	`question` text,
	`durationSeconds` int NOT NULL DEFAULT 2700,
	`cooldownSeconds` int NOT NULL DEFAULT 30,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `caseStudySections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entitlements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` int NOT NULL,
	`source` enum('purchase','admin','subscription','free') NOT NULL DEFAULT 'purchase',
	`status` enum('active','expired','revoked') NOT NULL DEFAULT 'active',
	`startsAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `entitlements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `markings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptId` int NOT NULL,
	`markerId` int,
	`status` enum('unassigned','assigned','in_progress','submitted') NOT NULL DEFAULT 'unassigned',
	`totalPoints` int NOT NULL DEFAULT 0,
	`awardedPoints` int NOT NULL DEFAULT 0,
	`feedback` text,
	`markedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `markings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mockExams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`title` varchar(240) NOT NULL,
	`examType` enum('case_study','objective_test') NOT NULL,
	`intro` text,
	`totalDurationSeconds` int NOT NULL DEFAULT 2700,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'published',
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `mockExams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('account','purchase','submission','marking') NOT NULL,
	`subject` varchar(240) NOT NULL,
	`body` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `objectiveQuestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mockExamId` int NOT NULL,
	`topic` varchar(180) NOT NULL,
	`learningOutcome` varchar(180),
	`questionType` enum('single_choice','multiple_choice','dropdown','numerical') NOT NULL,
	`prompt` text NOT NULL,
	`optionsJson` text NOT NULL,
	`answerJson` text NOT NULL,
	`explanation` text,
	`difficulty` enum('easy','medium','hard') NOT NULL DEFAULT 'medium',
	`status` enum('draft','published','retired') NOT NULL DEFAULT 'published',
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `objectiveQuestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`qualificationId` int,
	`title` varchar(240) NOT NULL,
	`category` enum('course','case_study','objective_test','resource','marking') NOT NULL,
	`description` text,
	`priceCents` int NOT NULL DEFAULT 0,
	`accessDays` int NOT NULL DEFAULT 365,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'published',
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `qualifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`code` varchar(40) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `qualifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `qualifications_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `resources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int,
	`title` varchar(240) NOT NULL,
	`kind` enum('pre_seen','formulae','printable_pdf','feedback','course_material','reference') NOT NULL,
	`fileKey` varchar(500),
	`fileUrl` text,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'published',
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `resources_id` PRIMARY KEY(`id`)
);
