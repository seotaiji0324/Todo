ALTER TABLE `members` ADD COLUMN `password_hash` text;
--> statement-breakpoint
ALTER TABLE `members` ADD COLUMN `password_salt` text;
--> statement-breakpoint
UPDATE `members`
SET
  `password_hash` = 'qfHefVyMYid4iiYjZgNs0TP4xGwVvqorGux+gRE2/g0=',
  `password_salt` = 'zjlP7gQxvYm+v/zi6kKHfA==',
  `updated_at` = CURRENT_TIMESTAMP
WHERE `username` = 'seotaiji0324';
--> statement-breakpoint
PRAGMA optimize;
