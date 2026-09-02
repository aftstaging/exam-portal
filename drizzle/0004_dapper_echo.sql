CREATE TABLE `paymentGatewaySettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(40) NOT NULL DEFAULT 'payfast',
	`mode` enum('sandbox','live') NOT NULL DEFAULT 'sandbox',
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paymentGatewaySettings_id` PRIMARY KEY(`id`)
);
