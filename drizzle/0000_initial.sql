CREATE TABLE `cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`folder_name` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`status` text NOT NULL,
	`archive_path` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_cycles_task_id` ON `cycles` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_cycles_status` ON `cycles` (`status`);--> statement-breakpoint
CREATE TABLE `file_manifest` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` text NOT NULL,
	`cycle_id` text,
	`path` text NOT NULL,
	`size` integer,
	`mtime` text,
	`hash` text,
	`etag` text,
	`state` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_file_manifest_task_cycle_path` ON `file_manifest` (`task_id`,`cycle_id`,`path`);--> statement-breakpoint
CREATE INDEX `idx_file_manifest_task_cycle` ON `file_manifest` (`task_id`,`cycle_id`);--> statement-breakpoint
CREATE INDEX `idx_file_manifest_hash` ON `file_manifest` (`hash`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`host` text,
	`port` integer,
	`username` text,
	`auth_method` text NOT NULL,
	`credentials_encrypted` text,
	`options_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_profiles_name` ON `profiles` (`name`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ssh_host_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`host` text NOT NULL,
	`port` integer NOT NULL,
	`fingerprint` text NOT NULL,
	`public_key` text NOT NULL,
	`algorithm` text,
	`trusted_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_ssh_host_keys_host_port` ON `ssh_host_keys` (`host`,`port`);--> statement-breakpoint
CREATE TABLE `task_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`cycle_id` text,
	`status` text NOT NULL,
	`started_at` text,
	`finished_at` text,
	`duration_ms` integer,
	`bytes_total` integer,
	`file_count` integer,
	`error_message` text,
	`log_path` text,
	`dry_run` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`cycle_id`) REFERENCES `cycles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_task_runs_task_id` ON `task_runs` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_task_runs_created_at` ON `task_runs` (`created_at`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`profile_id` text NOT NULL,
	`target_folder` text NOT NULL,
	`schedule_json` text NOT NULL,
	`settings_json` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`catch_up_missed` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tasks_name` ON `tasks` (`name`);--> statement-breakpoint
CREATE INDEX `idx_tasks_profile_id` ON `tasks` (`profile_id`);