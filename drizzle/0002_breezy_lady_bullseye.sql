CREATE TABLE `mt5_demo_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`broker` varchar(80) NOT NULL,
	`server` varchar(120) NOT NULL,
	`accountLogin` varchar(64) NOT NULL,
	`equity` decimal(16,2) NOT NULL,
	`balance` decimal(16,2) NOT NULL,
	`leverage` int NOT NULL,
	`lastSyncAtMs` bigint NOT NULL,
	`payload` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mt5_demo_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `mt5_demo_connections_last_sync_idx` ON `mt5_demo_connections` (`lastSyncAtMs`);