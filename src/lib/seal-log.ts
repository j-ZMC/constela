// Constela for Employers: the public history of seals, and the signed answer about one company's seal. Server only.
// The level is still worked out from the data on every request. The history only records when it changes, and each entry
// holds the hash of the one before, so nobody, Constela included, can change or take out an entry without it showing.
// shortcut: one file on one server, read whole on every answer; page it and keep a checked head once it grows.
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { MAX_COMPANY_CHARS, publicSeal, type PublicSeal, type PublicSnapshot } from "@/lib/public-employer";
import { SEAL_LEVELS, type SealLevel } from "@/lib/seal";
import { GENESIS, ISSUER, entryText, headOf, latestFor, sha256, verifyChain, type LogEntry, type SealClaims } from "@/lib/seal-proof";
import { signClaims } from "@/lib/seal-signing";

const file = () => join(process.cwd(), ".data", "seal-log.jsonl");
const hash = z.string().regex(/^[0-9a-f]{64}$/);
const entrySchema = z
  .object({ seq: z.number().int().nonnegative(), at: z.iso.datetime(), company: z.string().max(MAX_COMPANY_CHARS), level: z.enum(SEAL_LEVELS).nullable(), prev: hash, hash })
  .strict();

// A token is good for an hour at most, and never past the next promised answer date, because that date can drop the seal.
// A drop the employer causes can't be foreseen, so the check page also compares the token with the history.
export const TOKEN_SECONDS = 60 * 60;

export function expiry(snapshot: PublicSnapshot, now: Date): number {
  const dates = snapshot.responses.filter((r) => r.answeredAt === undefined && Date.parse(r.dueAt) > now.getTime()).map((r) => Math.floor(Date.parse(r.dueAt) / 1000));
  return Math.min(Math.floor(now.getTime() / 1000) + TOKEN_SECONDS, ...dates);
}

// No file yet is an empty history. A line that isn't an entry makes the whole history unreadable, so it is never extended.
export async function readLog(): Promise<LogEntry[]> {
  let text: string;
  try {
    text = await readFile(file(), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => entrySchema.parse(JSON.parse(line)));
}

// One change at a time, even when two requests notice the same drop together, so each change is written once.
// The queue lives on globalThis because Next may load this module once per route.
const state = ((globalThis as { [key: symbol]: unknown })[Symbol.for("constela.seal-log")] ??= { queue: Promise.resolve() }) as { queue: Promise<unknown> };

function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = state.queue.then(task, task);
  state.queue = run.catch(() => {});
  return run;
}

type Change = { company: string; level: SealLevel | null };

// A company enters the history when it first has a seal, and again each time the level changes or the seal ends.
function changes(snapshot: PublicSnapshot, entries: LogEntry[], now: Date, only?: string): Change[] {
  const names = only ? [only] : [...snapshot.vacancies.map((v) => v.company), ...entries.map((e) => e.company)];
  const seen = new Set<string>();
  const out: Change[] = [];
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const seal = publicSeal(snapshot, name, now);
    const last = latestFor(entries, name);
    if ((last?.level ?? null) !== seal.level) out.push({ company: seal.vacancyIds.length ? seal.company : (last?.company ?? name), level: seal.level });
  }
  return out;
}

async function append(entries: LogEntry[], list: Change[], now: Date): Promise<LogEntry[]> {
  const added: LogEntry[] = [];
  let prev = entries.at(-1)?.hash ?? GENESIS;
  for (const { company, level } of list) {
    const entry = { seq: entries.length + added.length, at: now.toISOString(), company, level, prev };
    added.push({ ...entry, hash: await sha256(entryText(entry)) });
    prev = added.at(-1)!.hash;
  }
  if (added.length > 0) {
    await mkdir(join(process.cwd(), ".data"), { recursive: true });
    await appendFile(file(), added.map((e) => `${JSON.stringify(e)}\n`).join(""));
  }
  return [...entries, ...added];
}

// Brings the history up to date with the data: for every company after a sync, or for the one asked about.
// A history that fails its own check is never extended, and no token points to it.
export function recordSeals(snapshot: PublicSnapshot, now: Date, only?: string): Promise<LogEntry[]> {
  return oneAtATime(async () => {
    const entries = await readLog();
    if (!(await verifyChain(entries)).ok) throw new Error("The seal history fails its own check.");
    return append(entries, changes(snapshot, entries, now, only), now);
  });
}

export type SignedSeal = PublicSeal & { token: string | null };

// Only a company with job posts here gets a token: signing whatever name someone asks about would let them put words
// in Constela's mouth. Asking about an unknown company writes nothing, unless the history says it once had a seal.
export async function signedSeal(snapshot: PublicSnapshot, company: string, now: Date): Promise<SignedSeal> {
  const seal = publicSeal(snapshot, company, now);
  try {
    const entries = await recordSeals(snapshot, now, company);
    if (seal.vacancyIds.length === 0) return { ...seal, token: null };
    const claims: SealClaims = { iss: ISSUER, sub: seal.company, level: seal.level, vacancyIds: seal.vacancyIds, iat: Math.floor(now.getTime() / 1000), exp: expiry(snapshot, now), log: headOf(entries) };
    return { ...seal, token: signClaims(claims) };
  } catch {
    // The level still answers; only the proof is missing, and the check page says so.
    return { ...seal, token: null };
  }
}
