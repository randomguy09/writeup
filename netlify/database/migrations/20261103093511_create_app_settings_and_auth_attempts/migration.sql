CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY,
	"value" text NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"ip" text PRIMARY KEY,
	"failures" integer DEFAULT 0 NOT NULL,
	"window_start" bigint NOT NULL
);
