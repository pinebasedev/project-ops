PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`token_hash` text NOT NULL,
	`github_repo` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_projects`(`id`, `name`, `token_hash`, `github_repo`, `created_at`) SELECT `id`, `name`, `token_hash`, `github_repo`, `created_at` FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `projects_name_unique`;