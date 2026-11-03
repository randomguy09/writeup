CREATE TABLE "writeups" (
	"id" serial PRIMARY KEY,
	"owner_id" text NOT NULL,
	"ctf" text NOT NULL,
	"challenge" text NOT NULL,
	"category" text DEFAULT 'web' NOT NULL,
	"difficulty" text DEFAULT 'Easy' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "writeups_owner_idx" ON "writeups" ("owner_id");