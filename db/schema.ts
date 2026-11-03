import { pgTable, serial, text, bigint, index } from "drizzle-orm/pg-core";

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
