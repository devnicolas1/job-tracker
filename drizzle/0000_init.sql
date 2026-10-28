CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`company` text NOT NULL,
	`location` text,
	`workplace_type` text,
	`employment_type` text,
	`seniority` text,
	`salary` text,
	`posted_at` text,
	`language` text,
	`description` text,
	`status` text DEFAULT 'new' NOT NULL,
	`status_changed_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`notes` text,
	`match_score` integer,
	`assessment` text,
	`tailored_resume` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_source_external_id_idx` ON `jobs` (`source`,`external_id`);--> statement-breakpoint
CREATE INDEX `jobs_status_score_idx` ON `jobs` (`status`,`match_score`);--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`basics` text,
	`preferences` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`section` text NOT NULL,
	`position` integer NOT NULL,
	`data` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `profile_entries_section_position_idx` ON `profile_entries` (`section`,`position`);--> statement-breakpoint
CREATE TABLE `resumes` (
	`language` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`stored_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
