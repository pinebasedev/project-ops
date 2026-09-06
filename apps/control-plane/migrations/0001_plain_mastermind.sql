ALTER TABLE `deployments` ADD `integration_tests_passed` integer;--> statement-breakpoint
ALTER TABLE `deployments` ADD `integration_tests_failed` integer;--> statement-breakpoint
ALTER TABLE `deployments` ADD `integration_tests_run_url` text;