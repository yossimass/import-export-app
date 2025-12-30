CREATE TABLE `alert_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`tariff_changes` boolean NOT NULL DEFAULT true,
	`regulation_updates` boolean NOT NULL DEFAULT true,
	`license_renewals` boolean NOT NULL DEFAULT true,
	`shipment_updates` boolean NOT NULL DEFAULT true,
	`email_notifications` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alert_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `alert_preferences_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`alert_type` enum('tariff_change','regulation_update','license_renewal','shipment_update') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`related_entity_id` int,
	`is_read` boolean NOT NULL DEFAULT false,
	`sent_at` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`session_id` varchar(100) NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `compliance_checklists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`origin_country` varchar(3) NOT NULL,
	`destination_country` varchar(3) NOT NULL,
	`hts_code` varchar(20),
	`product_description` text,
	`checklist_items` text NOT NULL,
	`completed_items` text,
	`status` enum('draft','in_progress','completed') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `compliance_checklists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `hts_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`description` text NOT NULL,
	`unit` varchar(50),
	`category` varchar(100),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `hts_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `hts_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `tariff_rates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hts_code_id` int NOT NULL,
	`origin_country` varchar(3) NOT NULL,
	`destination_country` varchar(3) NOT NULL,
	`rate` decimal(10,4) NOT NULL,
	`additional_duties` text,
	`effective_date` timestamp NOT NULL,
	`expiry_date` timestamp,
	`trade_agreement` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tariff_rates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trade_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`document_type` enum('certificate_of_origin','commercial_invoice','packing_list','customs_declaration','bill_of_lading','export_license','import_license','other') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`file_key` varchar(500) NOT NULL,
	`file_url` text NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`mime_type` varchar(100),
	`file_size` int,
	`shipment_reference` varchar(100),
	`expiry_date` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trade_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trade_regulations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`country_code` varchar(3) NOT NULL,
	`regulation_type` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`applicable_products` text,
	`requirements` text NOT NULL,
	`documentation_needed` text,
	`effective_date` timestamp NOT NULL,
	`last_updated` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`source_url` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trade_regulations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `user_idx` ON `alerts` (`user_id`);--> statement-breakpoint
CREATE INDEX `type_idx` ON `alerts` (`alert_type`);--> statement-breakpoint
CREATE INDEX `user_session_idx` ON `chat_messages` (`user_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `user_idx` ON `compliance_checklists` (`user_id`);--> statement-breakpoint
CREATE INDEX `code_idx` ON `hts_codes` (`code`);--> statement-breakpoint
CREATE INDEX `category_idx` ON `hts_codes` (`category`);--> statement-breakpoint
CREATE INDEX `hts_code_idx` ON `tariff_rates` (`hts_code_id`);--> statement-breakpoint
CREATE INDEX `countries_idx` ON `tariff_rates` (`origin_country`,`destination_country`);--> statement-breakpoint
CREATE INDEX `user_idx` ON `trade_documents` (`user_id`);--> statement-breakpoint
CREATE INDEX `type_idx` ON `trade_documents` (`document_type`);--> statement-breakpoint
CREATE INDEX `country_idx` ON `trade_regulations` (`country_code`);--> statement-breakpoint
CREATE INDEX `type_idx` ON `trade_regulations` (`regulation_type`);