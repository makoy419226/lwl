CREATE TABLE "bill_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_date" timestamp NOT NULL,
	"payment_method" text DEFAULT 'cash',
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer,
	"customer_name" text,
	"customer_phone" text,
	"amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0',
	"description" text,
	"bill_date" timestamp NOT NULL,
	"reference_number" text,
	"is_paid" boolean DEFAULT false,
	"created_by_worker_id" integer
);
--> statement-breakpoint
CREATE TABLE "client_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"bill_id" integer,
	"type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"date" timestamp NOT NULL,
	"running_balance" numeric(12, 2) NOT NULL,
	"payment_method" text DEFAULT 'cash',
	"discount" numeric(12, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact" text,
	"email" text,
	"address" text,
	"phone" text,
	"phone_modified" boolean DEFAULT false,
	"amount" numeric(12, 2) DEFAULT '0',
	"deposit" numeric(12, 2) DEFAULT '0',
	"balance" numeric(12, 2) DEFAULT '0',
	"notes" text,
	"bill_number" text,
	"preferred_payment_method" text DEFAULT 'cash',
	"discount_percent" numeric(5, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"customer_address" text,
	"order_id" integer,
	"order_number" text,
	"item_name" text,
	"reason" text NOT NULL,
	"notes" text,
	"refund_amount" numeric(12, 2) DEFAULT '0',
	"item_value" numeric(12, 2) DEFAULT '0',
	"responsible_staff_id" integer,
	"responsible_staff_name" text,
	"reporter_name" text,
	"incident_type" text DEFAULT 'refund',
	"incident_stage" text DEFAULT 'delivery',
	"status" text DEFAULT 'open',
	"incident_date" timestamp NOT NULL,
	"resolved_date" timestamp,
	"resolution" text
);
--> statement-breakpoint
CREATE TABLE "missing_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer,
	"order_number" text,
	"customer_name" text,
	"item_name" text NOT NULL,
	"quantity" integer DEFAULT 1,
	"item_value" numeric(12, 2) DEFAULT '0',
	"stage" text NOT NULL,
	"responsible_worker_id" integer,
	"responsible_worker_name" text,
	"reported_by_worker_id" integer,
	"reported_by_worker_name" text,
	"notes" text,
	"status" text DEFAULT 'reported',
	"reported_at" timestamp NOT NULL,
	"resolved_at" timestamp,
	"resolution" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer,
	"bill_id" integer,
	"customer_name" text,
	"order_number" text NOT NULL,
	"items" text,
	"total_amount" numeric(12, 2) NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0',
	"discount_percent" numeric(5, 2) DEFAULT '0',
	"discount_amount" numeric(12, 2) DEFAULT '0',
	"final_amount" numeric(12, 2),
	"payment_method" text DEFAULT 'cash',
	"status" text DEFAULT 'entry',
	"delivery_type" text DEFAULT 'takeaway',
	"expected_delivery_at" timestamp,
	"entry_date" timestamp NOT NULL,
	"entry_by" text,
	"tag_done" boolean DEFAULT false,
	"tag_date" timestamp,
	"tag_by" text,
	"tag_worker_id" integer,
	"washing_done" boolean DEFAULT false,
	"washing_date" timestamp,
	"washing_by" text,
	"packing_done" boolean DEFAULT false,
	"packing_date" timestamp,
	"packing_by" text,
	"packing_worker_id" integer,
	"delivered" boolean DEFAULT false,
	"delivery_date" timestamp,
	"delivery_by" text,
	"delivered_by_worker_id" integer,
	"notes" text,
	"urgent" boolean DEFAULT false,
	"public_view_token" text,
	"tips" numeric(12, 2) DEFAULT '0',
	"delivery_photo" text,
	"delivery_photos" text[],
	"stock_deducted" boolean DEFAULT false,
	"item_count_verified" boolean DEFAULT false,
	"verified_at" timestamp,
	"verified_by_worker_id" integer,
	"verified_by_worker_name" text,
	"item_count_at_intake" integer,
	"item_count_at_release" integer
);
--> statement-breakpoint
CREATE TABLE "packing_workers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"pin" text NOT NULL,
	"active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2),
	"sku" text,
	"category" text DEFAULT 'Laundry',
	"stock_quantity" integer DEFAULT 0,
	"image_url" text
);
--> statement-breakpoint
CREATE TABLE "stage_checklists" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"stage" text NOT NULL,
	"checked_items" text,
	"total_items" integer NOT NULL,
	"checked_count" integer DEFAULT 0,
	"is_complete" boolean DEFAULT false,
	"started_at" timestamp,
	"completed_at" timestamp,
	"worker_id" integer,
	"worker_name" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"pin" text DEFAULT '12345' NOT NULL,
	"role" text DEFAULT 'cashier' NOT NULL,
	"name" text,
	"email" text,
	"active" boolean DEFAULT true,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
