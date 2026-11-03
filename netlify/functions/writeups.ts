import type { Config, Context } from "@netlify/functions";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { writeups } from "../../db/schema.js";

const CATEGORIES = ["pwn", "web", "crypto", "forensics", "rev", "osint"];
const DIFFICULTIES = ["Textbook", "Easy", "Medium", "Hard"];
const OWNER_RE = /^[a-zA-Z0-9-]{20,64}$/;
const MAX_CONTENT = 4_500_000; // stay under the function payload limit (pasted images are inlined)

const json = (data: unknown, status = 200) => Response.json(data, { status });

function parseBody(body: any) {
  const ctf = String(body?.ctf ?? "").trim().slice(0, 200);
  const challenge = String(body?.challenge ?? "").trim().slice(0, 200);
  if (!ctf || !challenge) return { error: "CTF Name and Challenge Name are required." };
  const content = String(body?.content ?? "");
  if (content.length > MAX_CONTENT) return { error: "Write-up is too large. Try using smaller images." };
  return {
    value: {
      ctf,
      challenge,
      category: CATEGORIES.includes(body?.category) ? body.category : "web",
      difficulty: DIFFICULTIES.includes(body?.difficulty) ? body.difficulty : "Easy",
      summary: String(body?.summary ?? "").slice(0, 500),
      content,
    },
  };
}

export default async (req: Request, context: Context) => {
  const ownerId = req.headers.get("x-owner-id") ?? "";
  if (!OWNER_RE.test(ownerId)) return json({ error: "Missing or invalid owner id." }, 401);

  const id = context.params.id ? Number(context.params.id) : null;
  if (context.params.id && !Number.isInteger(id)) return json({ error: "Invalid id." }, 400);

  try {
    if (req.method === "GET" && id === null) {
      const rows = await db
        .select()
        .from(writeups)
        .where(eq(writeups.ownerId, ownerId))
        .orderBy(desc(writeups.createdAt));
      return json(rows.map(({ ownerId: _o, ...r }) => r));
    }

    if (req.method === "POST" && id === null) {
      const parsed = parseBody(await req.json().catch(() => null));
      if ("error" in parsed) return json({ error: parsed.error }, 400);
      const now = Date.now();
      const [row] = await db
        .insert(writeups)
        .values({ ...parsed.value, ownerId, createdAt: now, updatedAt: now })
        .returning();
      const { ownerId: _o, ...rest } = row;
      return json(rest, 201);
    }

    if (req.method === "PUT" && id !== null) {
      const parsed = parseBody(await req.json().catch(() => null));
      if ("error" in parsed) return json({ error: parsed.error }, 400);
      const [row] = await db
        .update(writeups)
        .set({ ...parsed.value, updatedAt: Date.now() })
        .where(and(eq(writeups.id, id), eq(writeups.ownerId, ownerId)))
        .returning();
      if (!row) return json({ error: "Not found." }, 404);
      const { ownerId: _o, ...rest } = row;
      return json(rest);
    }

    if (req.method === "DELETE" && id !== null) {
      const deleted = await db
        .delete(writeups)
        .where(and(eq(writeups.id, id), eq(writeups.ownerId, ownerId)))
        .returning({ id: writeups.id });
      if (deleted.length === 0) return json({ error: "Not found." }, 404);
      return new Response(null, { status: 204 });
    }

    return json({ error: "Method not allowed." }, 405);
  } catch (err) {
    console.error("writeups API error:", err);
    return json({ error: "Server error." }, 500);
  }
};

export const config: Config = {
  path: ["/api/writeups", "/api/writeups/:id"],
};
