CREATE TABLE `contact_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'New' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_subscribers_email_unique` ON `newsletter_subscribers` (`email`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_number` text NOT NULL,
	`customer_email` text NOT NULL,
	`total` real NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`sku` text NOT NULL,
	`category` text NOT NULL,
	`brand` text NOT NULL,
	`description` text NOT NULL,
	`price` real NOT NULL,
	`sale_price` real,
	`stock` integer DEFAULT 0 NOT NULL,
	`image` text,
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`role` text DEFAULT 'customer' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);