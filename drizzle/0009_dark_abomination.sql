CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` int NOT NULL,
	`provider` enum('payfast','stripe','admin') NOT NULL,
	`reference` varchar(120),
	`amountCents` int NOT NULL DEFAULT 0,
	`currency` varchar(12) NOT NULL DEFAULT 'ZAR',
	`status` enum('pending','completed','cancelled','refunded') NOT NULL DEFAULT 'completed',
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','instructor','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `entitlements` ADD `grantedBy` int;