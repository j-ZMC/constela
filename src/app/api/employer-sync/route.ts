import { MAX_SNAPSHOT_CHARS, publicSnapshotSchema } from "@/lib/public-employer";
import { clearSnapshot, writeSnapshot } from "@/lib/public-store";

// Keeps the public API's copy up to date. A PUT or DELETE from another site needs a preflight, and this route has no
// CORS headers, so a browser can't call it from anywhere else.
// shortcut: without accounts nothing proves who is writing, so a stranger with direct access could post a fake job or seal.
// Writes stay off outside `npm run dev` unless PUBLIC_API_WRITES=on; add accounts before this runs anywhere public.
const writable = () => process.env.NODE_ENV === "development" || process.env.PUBLIC_API_WRITES === "on";

const fail = (error: string, status: number) => Response.json({ error }, { status });

function parse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function PUT(req: Request) {
  if (!writable()) return fail("not_configured", 503);
  const text = await req.text();
  const parsed = publicSnapshotSchema.safeParse(text.length <= MAX_SNAPSHOT_CHARS ? parse(text) : null);
  if (!parsed.success) return fail("invalid_input", 400);
  try {
    await writeSnapshot(parsed.data);
    return new Response(null, { status: 204 });
  } catch {
    return fail("failed", 500);
  }
}

export async function DELETE() {
  if (!writable()) return fail("not_configured", 503);
  try {
    await clearSnapshot();
    return new Response(null, { status: 204 });
  } catch {
    return fail("failed", 500);
  }
}
