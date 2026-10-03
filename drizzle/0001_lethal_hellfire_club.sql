CREATE TABLE `datasets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`hash` text NOT NULL,
	`status` text NOT NULL,
	`created` text NOT NULL,
	`headers` text NOT NULL,
	`profile` text NOT NULL,
	`config` text,
	`report` text,
	`raw` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `semantic_chunks` (
	`dataset_id` text NOT NULL,
	`n` integer NOT NULL,
	`digest` text NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`dataset_id`, `n`)
);
--> statement-breakpoint
CREATE TABLE `standard_rows` (
	`dataset_id` text NOT NULL,
	`row_no` integer NOT NULL,
	`row_hash` text NOT NULL,
	`order_id` text,
	`user_id` text,
	`amount` real,
	`quantity` real,
	`event_time` text,
	`event_date` text,
	`channel` text,
	`device` text,
	`product_id` text,
	`product_name` text,
	`category` text,
	`event_type` text,
	`event_id` text,
	`session_id` text,
	`line_id` text,
	`region` text,
	`user_type` text,
	`issues` text NOT NULL,
	PRIMARY KEY(`dataset_id`, `row_no`)
);
--> statement-breakpoint
CREATE INDEX `standard_rows_order` ON `standard_rows` (`dataset_id`,`order_id`);--> statement-breakpoint
CREATE INDEX `standard_rows_hash` ON `standard_rows` (`dataset_id`,`row_hash`);--> statement-breakpoint
CREATE INDEX `standard_rows_event` ON `standard_rows` (`dataset_id`,`event_id`);