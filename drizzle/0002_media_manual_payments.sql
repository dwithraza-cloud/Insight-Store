CREATE TABLE IF NOT EXISTS `media_assets` (`id` text PRIMARY KEY NOT NULL,`object_key` text NOT NULL UNIQUE,`original_name` text NOT NULL,`mime_type` text NOT NULL,`size` integer NOT NULL,`width` integer,`height` integer,`kind` text NOT NULL,`created_by` text,`created_at` integer NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `store_orders` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`order_number` text NOT NULL UNIQUE,`access_token` text,`customer_name` text NOT NULL,`email` text NOT NULL,`phone` text NOT NULL,`city` text NOT NULL,`postal_code` text,`address` text NOT NULL,`subtotal` real NOT NULL,`shipping` real NOT NULL,`tax` real NOT NULL,`total` real NOT NULL,`payment_method` text NOT NULL,`payment_status` text NOT NULL,`order_status` text NOT NULL,`transaction_reference` text NOT NULL UNIQUE,`proof_url` text NOT NULL,`admin_note` text,`verified_by` text,`verified_at` integer,`created_at` integer NOT NULL,`updated_at` integer NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `order_items` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`order_id` integer NOT NULL,`product_id` integer NOT NULL,`title` text NOT NULL,`sku` text NOT NULL,`quantity` integer NOT NULL,`unit_price` real NOT NULL,`image` text,FOREIGN KEY (`order_id`) REFERENCES `store_orders`(`id`));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_store_orders_status_created` ON `store_orders` (`payment_status`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `upload_limits` (`bucket` text PRIMARY KEY NOT NULL,`count` integer NOT NULL,`updated_at` integer NOT NULL);
