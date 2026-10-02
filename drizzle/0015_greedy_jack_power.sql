CREATE TABLE `supervisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentId` int NOT NULL,
	`instructorId` int NOT NULL,
	`status` enum('active','ended') NOT NULL DEFAULT 'active',
	`notes` text,
	`assignedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`endedAt` timestamp,
	CONSTRAINT `supervisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `resources` MODIFY COLUMN `kind` enum('pre_seen','formulae','printable_pdf','feedback','course_material','reference','email','instructions') NOT NULL;