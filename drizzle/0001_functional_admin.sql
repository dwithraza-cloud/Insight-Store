CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `authenticated_user_id` text NOT NULL UNIQUE,
  `email` text NOT NULL,
  `name` text NOT NULL DEFAULT 'Admin User',
  `role` text NOT NULL DEFAULT 'super_admin',
  `active` integer NOT NULL DEFAULT 1,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `catalog_products` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `source_id` integer,
  `title` text NOT NULL,
  `slug` text NOT NULL UNIQUE,
  `sku` text NOT NULL UNIQUE,
  `category` text NOT NULL,
  `brand` text NOT NULL,
  `description` text NOT NULL DEFAULT '',
  `price` real NOT NULL,
  `old_price` real,
  `stock_quantity` integer NOT NULL DEFAULT 0,
  `image` text,
  `image_2` text,
  `image_3` text,
  `video_url` text,
  `badge` text,
  `rating` real NOT NULL DEFAULT 5,
  `status` text NOT NULL DEFAULT 'active',
  `featured` integer NOT NULL DEFAULT 0,
  `color` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admin_records` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `entity` text NOT NULL,
  `title` text NOT NULL,
  `status` text NOT NULL DEFAULT 'active',
  `data_json` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_admin_records_entity_updated` ON `admin_records` (`entity`,`updated_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `store_settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value_json` text NOT NULL,
  `updated_by` text,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `admin_user_id` text NOT NULL,
  `action` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text,
  `summary` text NOT NULL,
  `metadata_json` text,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_audit_logs_created` ON `audit_logs` (`created_at`);
