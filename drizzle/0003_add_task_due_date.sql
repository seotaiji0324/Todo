ALTER TABLE `tasks` ADD COLUMN `due_date` text;
--> statement-breakpoint
UPDATE `tasks`
SET `due_date` = COALESCE(substr(`created_at`, 1, 10), date('now'))
WHERE `due_date` IS NULL;
--> statement-breakpoint
CREATE INDEX `idx_tasks_owner_due_date` ON `tasks` (`owner_id`, `due_date`);
