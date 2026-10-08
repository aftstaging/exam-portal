CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`senderId` int NOT NULL,
	`recipientId` int NOT NULL,
	`body` text NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `submissionComments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptId` int NOT NULL,
	`authorId` int NOT NULL,
	`body` text NOT NULL,
	`visibleToLearner` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `submissionComments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bio` text,
	`phone` varchar(40),
	`headline` varchar(160),
	`employer` varchar(200),
	`city` varchar(120),
	`country` varchar(120),
	`dateOfBirth` varchar(10),
	`linkedinUrl` varchar(400),
	`targetQualification` varchar(200),
	`emergencyContactName` varchar(200),
	`emergencyContactPhone` varchar(40),
	`avatarKey` varchar(500),
	`avatarUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `userProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `notifications` MODIFY COLUMN `type` enum('account','purchase','submission','marking','message','comment','profile','supervision') NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` ADD `link` varchar(500);--> statement-breakpoint
ALTER TABLE `notifications` ADD `emailedAt` timestamp;