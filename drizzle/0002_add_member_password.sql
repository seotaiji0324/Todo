ALTER TABLE `members` ADD COLUMN `password_hash` text;
--> statement-breakpoint
ALTER TABLE `members` ADD COLUMN `password_salt` text;
--> statement-breakpoint
UPDATE `members`
SET
  `password_hash` = 'xX0dIGnoKXvicU5gsgisl2aLlcOW/nOAo/9DGaN+6To=',
  `password_salt` = 'zjlP7gQxvYm+v/zi6kKHfA==',
  `updated_at` = CURRENT_TIMESTAMP
WHERE `username` = 'seotaiji0324';
--> statement-breakpoint
PRAGMA optimize;
