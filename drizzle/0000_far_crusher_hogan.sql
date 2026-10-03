CREATE TABLE `calls` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor` text NOT NULL,
	`ip` text NOT NULL,
	`day` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL,
	`question` text NOT NULL,
	`tokens` integer DEFAULT 0 NOT NULL,
	`plan` text,
	`sql` text,
	`result` text
);
--> statement-breakpoint
CREATE INDEX `calls_visitor_status` ON `calls` (`visitor`,`status`);--> statement-breakpoint
CREATE INDEX `calls_day_status` ON `calls` (`day`,`status`);--> statement-breakpoint
CREATE TABLE `chunks` (
	`import_id` text NOT NULL,
	`n` integer NOT NULL,
	PRIMARY KEY(`import_id`, `n`)
);
--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`sample` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	`report` text,
	`raw` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `months` (
	`month` text PRIMARY KEY NOT NULL,
	`import_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`import_id` text NOT NULL,
	`sid` text NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`views` integer NOT NULL,
	`adds` integer NOT NULL,
	`checkouts` integer NOT NULL,
	`purchases` integer NOT NULL,
	`ordered` integer NOT NULL,
	`quantity` real NOT NULL,
	`revenue` real NOT NULL,
	PRIMARY KEY(`import_id`, `sid`, `sku`)
);
--> statement-breakpoint
CREATE TABLE `saved` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`plan` text NOT NULL,
	`follow` integer DEFAULT 1 NOT NULL,
	`display` text DEFAULT 'table' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`import_id` text NOT NULL,
	`sid` text NOT NULL,
	`date` text NOT NULL,
	`month` text NOT NULL,
	`visitor` text NOT NULL,
	`channel` text NOT NULL,
	`device` text NOT NULL,
	`transactions` integer NOT NULL,
	`revenue` real NOT NULL,
	`buyer` integer NOT NULL,
	`views` integer NOT NULL,
	`adds` integer NOT NULL,
	`checkouts` integer NOT NULL,
	`purchases` integer NOT NULL,
	`ordered` integer NOT NULL,
	`hits` integer NOT NULL,
	`purchase_events` integer NOT NULL,
	`transaction_ids` integer NOT NULL,
	`missing_ids` integer NOT NULL,
	PRIMARY KEY(`import_id`, `sid`)
);
--> statement-breakpoint
CREATE INDEX `sessions_month_import` ON `sessions` (`month`,`import_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
