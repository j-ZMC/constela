import { EMPTY_SNAPSHOT, MAX_SNAPSHOT_CHARS, publicSnapshotSchema, type PublicSnapshot } from "@/lib/public-employer";
import { clearSnapshot, writeSnapshot } from "@/lib/public-store";
import { recordSeals } from "@/lib/seal-log";

// Keeps the public API's copy up to date. A PUT or DELETE from another site needs a preflight, and this route has no
// CORS headers, so a browser can't call it from anywhere else.
// shortcut: without accounts nothing proves who is writing, so a stranger with direct access could post a fake job or seal.
// Writes stay off outside `npm run dev` unless PUBLIC_API_WRITES=on; add accounts before this runs anywhere public.
const writable = () => process.env.NODE_ENV === "development" || process.env.PUBLIC_API_WRITES === "on";

const fail = (error: string, status: number) => Response.json({ error }, { status });

// The data is saved either way. A change the history misses here is recorded the next time anyone asks about that company.
const record = (snapshot: PublicSnapshot) => recordSeals(snapshot, new Date()).catch(() => {});

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
    await record(parsed.data);
    return new Response(null, { status: 204 });
  } catch {
    return fail("failed", 500);
  }
}

export async function DELETE() {
  if (!writable()) return fail("not_configured", 503);
  try {
    await clearSnapshot();
    await record(EMPTY_SNAPSHOT); // the seal ends; the history keeps that it once had one
    return new Response(null, { status: 204 });
  } catch {
    return fail("failed", 500);
  }
}
