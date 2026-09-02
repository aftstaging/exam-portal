CREATE TABLE `feedbackStates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptId` int NOT NULL,
	`state` enum('not_available','awaiting_marking','in_progress','available') NOT NULL DEFAULT 'not_available',
	`summary` text,
	`fileKey` varchar(500),
	`fileUrl` text,
	`releasedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `feedbackStates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `qualificationLevels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`qualificationId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`sequence` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `qualificationLevels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptId` int NOT NULL,
	`submittedBy` int NOT NULL,
	`status` enum('locked','received','under_review','released') NOT NULL DEFAULT 'locked',
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`releasedAt` timestamp,
	CONSTRAINT `submissions_id` PRIMARY KEY(`id`)
);
