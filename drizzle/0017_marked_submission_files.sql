CREATE TABLE `markedSubmissionFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptId` int NOT NULL,
	`uploadedBy` int NOT NULL,
	`fileName` varchar(240) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`sizeBytes` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `markedSubmissionFiles_id` PRIMARY KEY(`id`)
);
