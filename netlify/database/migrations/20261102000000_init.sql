CREATE TYPE "public"."alert_type" AS ENUM('tariff_change', 'regulation_update', 'license_renewal', 'shipment_status');--> statement-breakpoint
CREATE TYPE "public"."certificate_status" AS ENUM('draft', 'issued', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."chat_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."coo_status" AS ENUM('none', 'draft', 'issued');--> statement-breakpoint
CREATE TYPE "public"."credit_transaction_type" AS ENUM('purchase', 'subscription_refill', 'usage', 'refund', 'admin_adjustment');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('uploaded', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('draft', 'calculating', 'documenting', 'reviewing', 'complete');--> statement-breakpoint
CREATE TYPE "public"."subscription_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'cancelled', 'past_due', 'unpaid');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "alerts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"alertType" "alert_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"htsCode" varchar(20),
	"countryCode" varchar(3),
	"shipmentId" integer,
	"read" boolean DEFAULT false,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "certificates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"shipmentId" integer,
	"certificateNumber" varchar(50) NOT NULL,
	"status" "certificate_status" DEFAULT 'draft' NOT NULL,
	"tradeAgreement" varchar(50) DEFAULT 'GENERIC',
	"agreementFields" jsonb,
	"exporterName" varchar(255) NOT NULL,
	"exporterAddress" text,
	"exporterCountry" varchar(3),
	"exporterSignatory" varchar(255),
	"consigneeName" varchar(255) NOT NULL,
	"consigneeAddress" text,
	"consigneeCountry" varchar(3),
	"htsCode" varchar(20),
	"goodsDescription" text,
	"quantity" varchar(100),
	"quantityUnit" varchar(50),
	"grossWeight" varchar(100),
	"netWeight" varchar(100),
	"marksNumbers" text,
	"invoiceNumber" varchar(100),
	"countryOfOrigin" varchar(3) NOT NULL,
	"originCriterion" varchar(10),
	"producerDeclaration" text,
	"departureDate" varchar(20),
	"vessel" varchar(255),
	"portOfLoading" varchar(255),
	"portOfDischarge" varchar(255),
	"destinationCountry" varchar(3),
	"chamberName" varchar(255),
	"issueDate" varchar(20),
	"issuePlace" varchar(255),
	"validationResult" jsonb,
	"pdfUrl" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatMessages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chatMessages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"conversationId" varchar(100) NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklists" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "checklists_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"shipmentId" integer NOT NULL,
	"userId" integer NOT NULL,
	"htsCode" varchar(20),
	"originCountry" varchar(3),
	"destinationCountry" varchar(3),
	"items" jsonb NOT NULL,
	"generatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creditTransactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "creditTransactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"amount" numeric(15, 4) NOT NULL,
	"balanceAfter" numeric(15, 4) NOT NULL,
	"type" "credit_transaction_type" NOT NULL,
	"description" text NOT NULL,
	"llmCost" numeric(15, 6),
	"markupRate" numeric(5, 2),
	"featureUsed" varchar(100),
	"shipmentId" integer,
	"stripePaymentIntentId" varchar(255),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "documents_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"shipmentId" integer,
	"userId" integer NOT NULL,
	"documentType" varchar(100) NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"fileKey" varchar(500) NOT NULL,
	"fileUrl" varchar(1000) NOT NULL,
	"mimeType" varchar(100),
	"fileSize" integer,
	"status" "document_status" DEFAULT 'uploaded',
	"uploadedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shipments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"status" "shipment_status" DEFAULT 'draft' NOT NULL,
	"workflowStep" integer DEFAULT 1 NOT NULL,
	"shipmentName" varchar(255) NOT NULL,
	"productDescription" text,
	"htsCode" varchar(20),
	"originCountry" varchar(3),
	"destinationCountry" varchar(3),
	"quantity" numeric(15, 4),
	"weight" numeric(15, 4),
	"weightUnit" varchar(10),
	"value" numeric(15, 2),
	"currency" varchar(3) DEFAULT 'USD',
	"incoterm" varchar(10),
	"freightCost" numeric(15, 2),
	"insuranceCost" numeric(15, 2),
	"lastCalculation" jsonb,
	"complianceChecklist" jsonb,
	"userOverrides" jsonb,
	"riskScore" integer,
	"riskLevel" "risk_level",
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"completedAt" timestamp with time zone,
	"cooStatus" "coo_status" DEFAULT 'none' NOT NULL,
	"cooId" integer,
	"poData" jsonb
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "subscriptions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" integer NOT NULL,
	"stripeSubscriptionId" varchar(255) NOT NULL,
	"stripeCustomerId" varchar(255) NOT NULL,
	"stripePriceId" varchar(255) NOT NULL,
	"tier" varchar(50) NOT NULL,
	"interval" "subscription_interval" NOT NULL,
	"creditsPerPeriod" numeric(15, 4) NOT NULL,
	"status" "subscription_status" NOT NULL,
	"currentPeriodStart" timestamp with time zone,
	"currentPeriodEnd" timestamp with time zone,
	"cancelAtPeriodEnd" boolean DEFAULT false,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripeSubscriptionId_unique" UNIQUE("stripeSubscriptionId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"credits" numeric(15, 4) DEFAULT '0' NOT NULL,
	"initialSearchesUsed" integer DEFAULT 0 NOT NULL,
	"monthlySearchesUsed" integer DEFAULT 0 NOT NULL,
	"lastMonthlyReset" timestamp with time zone DEFAULT now() NOT NULL,
	"stripeCustomerId" varchar(255),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE INDEX "alerts_user_idx" ON "alerts" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "certificates_user_idx" ON "certificates" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "certificates_shipment_idx" ON "certificates" USING btree ("shipmentId");--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_idx" ON "chatMessages" USING btree ("userId","conversationId");--> statement-breakpoint
CREATE INDEX "checklists_shipment_idx" ON "checklists" USING btree ("shipmentId");--> statement-breakpoint
CREATE INDEX "credit_transactions_user_idx" ON "creditTransactions" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "documents_user_idx" ON "documents" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "documents_shipment_idx" ON "documents" USING btree ("shipmentId");--> statement-breakpoint
CREATE INDEX "shipments_user_idx" ON "shipments" USING btree ("userId","updatedAt");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("userId");