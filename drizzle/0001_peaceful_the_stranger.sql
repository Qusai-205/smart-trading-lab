CREATE TABLE `analysis_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`cronExpression` varchar(80) NOT NULL DEFAULT '0 0 9 * * 1-5',
	`schedule_cron_task_uid` varchar(65),
	`emailAlertsEnabled` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `analysis_schedules_id` PRIMARY KEY(`id`),
	CONSTRAINT `analysis_schedules_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `analysis_signals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`assetId` int NOT NULL,
	`direction` enum('bullish','bearish','neutral','insufficient_data') NOT NULL,
	`strength` int NOT NULL,
	`dataCoverage` int NOT NULL,
	`reasons` json NOT NULL,
	`limitations` json NOT NULL,
	`indicators` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysis_signals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `backtest_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`assetId` int,
	`startAtMs` bigint NOT NULL,
	`endAtMs` bigint NOT NULL,
	`slippageBps` int NOT NULL,
	`metrics` json NOT NULL,
	`limitations` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `backtest_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `market_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`label` varchar(80),
	`assetClass` enum('equity','crypto','etf') NOT NULL DEFAULT 'equity',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `market_assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `market_assets_user_symbol_unique` UNIQUE(`userId`,`symbol`)
);
--> statement-breakpoint
CREATE TABLE `market_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`capturedAtMs` bigint NOT NULL,
	`open` decimal(16,6) NOT NULL,
	`high` decimal(16,6) NOT NULL,
	`low` decimal(16,6) NOT NULL,
	`close` decimal(16,6) NOT NULL,
	`volume` decimal(22,2),
	CONSTRAINT `market_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paper_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`side` enum('buy','sell') NOT NULL,
	`quantity` int NOT NULL,
	`status` varchar(40) NOT NULL,
	`brokerOrderId` varchar(80),
	`payload` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paper_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `risk_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`accountEquity` decimal(16,2) NOT NULL,
	`riskPerTradePercent` decimal(5,2) NOT NULL,
	`maxPositionPercent` decimal(5,2) NOT NULL,
	`stopAtrMultiplier` decimal(5,2) NOT NULL,
	`rewardRiskRatio` decimal(5,2) NOT NULL,
	`alertOnRiskBreach` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `risk_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `risk_settings_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','user') NOT NULL DEFAULT 'user';--> statement-breakpoint
CREATE INDEX `analysis_schedules_task_uid_idx` ON `analysis_schedules` (`schedule_cron_task_uid`);--> statement-breakpoint
CREATE INDEX `analysis_signals_user_asset_created_idx` ON `analysis_signals` (`userId`,`assetId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `backtest_runs_user_created_idx` ON `backtest_runs` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `market_assets_user_active_idx` ON `market_assets` (`userId`,`active`);--> statement-breakpoint
CREATE INDEX `market_snapshots_asset_time_idx` ON `market_snapshots` (`assetId`,`capturedAtMs`);--> statement-breakpoint
CREATE INDEX `paper_orders_user_created_idx` ON `paper_orders` (`userId`,`createdAt`);