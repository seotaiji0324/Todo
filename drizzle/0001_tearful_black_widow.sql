CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_user_id` text,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_auth_user_id` ON `members` (`auth_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_username` ON `members` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_members_email` ON `members` (`email`);--> statement-breakpoint
INSERT INTO `members` (
  `id`,
  `auth_user_id`,
  `username`,
  `display_name`,
  `email`,
  `role`,
  `status`,
  `last_login_at`,
  `created_at`,
  `updated_at`
) VALUES (
  'member_admin_seotaiji0324',
  NULL,
  'seotaiji0324',
  '서태지',
  'hyunho76.seo@miracom-inc.com',
  'admin',
  'active',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);--> statement-breakpoint
PRAGMA optimize;
