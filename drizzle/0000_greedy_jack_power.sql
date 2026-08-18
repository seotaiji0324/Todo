CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT '개인' NOT NULL,
	`due_time` text,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_owner_completed` ON `tasks` (`owner_id`,`completed`);--> statement-breakpoint
CREATE INDEX `idx_tasks_owner_created` ON `tasks` (`owner_id`,`created_at`);