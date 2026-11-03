import { pgTable, serial, text, bigint, index, integer } from "drizzle-orm/pg-core";

export const writeups = pgTable(
  "writeups",
  {
    id: serial().primaryKey(),
    ownerId: text("owner_id").notNull(),
    ctf: text().notNull(),
    challenge: text().notNull(),
    category: text().notNull().default("web"),
    difficulty: text().notNull().default("Easy"),
    summary: text().notNull().default(""),
    content: text().notNull().default(""),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [index("writeups_owner_idx").on(t.ownerId)]
);

// Key/value settings (e.g. the scrypt hash of the create-password).
export const appSettings = pgTable("app_settings", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

// Failed password attempts per client IP, used for brute-force lockout.
export const authAttempts = pgTable("auth_attempts", {
  ip: text().primaryKey(),
  failures: integer().notNull().default(0),
  windowStart: bigint("window_start", { mode: "number" }).notNull(),
});
