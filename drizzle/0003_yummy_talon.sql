CREATE TABLE `mt5_demo_bars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountLogin` varchar(64) NOT NULL,
	`symbol` varchar(30) NOT NULL,
	`timeframe` varchar(12) NOT NULL,
	`capturedAtMs` bigint NOT NULL,
	`open` decimal(16,6) NOT NULL,
	`high` decimal(16,6) NOT NULL,
	`low` decimal(16,6) NOT NULL,
	`close` decimal(16,6) NOT NULL,
	`volume` decimal(22,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mt5_demo_bars_id` PRIMARY KEY(`id`),
	CONSTRAINT `mt5_demo_bars_unique` UNIQUE(`accountLogin`,`symbol`,`timeframe`,`capturedAtMs`)
);
--> statement-breakpoint
CREATE INDEX `mt5_demo_bars_lookup_idx` ON `mt5_demo_bars` (`accountLogin`,`symbol`,`timeframe`,`capturedAtMs`);