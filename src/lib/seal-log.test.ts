import { createPrivateKey } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PUT } from "@/app/api/employer-sync/route";
import { GET as keysRoute, OPTIONS as keysOptions } from "@/app/api/public/seal/keys/route";
import { GET as logRoute } from "@/app/api/public/seal/log/route";
import { EMPTY_SNAPSHOT, publicSnapshot, type PublicSnapshot } from "@/lib/public-employer";
import { TOKEN_SECONDS, readLog, recordSeals, signedSeal } from "@/lib/seal-log";
import { GENESIS, entryText, forge, holdsHead, sha256, verifyChain, verifySeal, type LogEntry, type SealClaims, type SealJwk } from "@/lib/seal-proof";
import { thumbprint } from "@/lib/seal-signing";
import { DEMO_VACANCY } from "@/lib/vacancy";

// connection() keeps the routes out of the build; outside a real request it throws, so here it stands for one.
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => {} }));

const now = new Date("2026-11-04T12:00:00.000Z");
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
const iso = (minutes: number) => at(minutes).toISOString();
const seconds = (d: Date) => Math.floor(d.getTime() / 1000);

// The demo job post offers adjustments and another format, so an answer sent on time makes it silver.
const snapshot = (guideRead: boolean, responses: PublicSnapshot["responses"] = []) => publicSnapshot({ vacancies: [DEMO_VACANCY], guideRead, responses });
const BRONZE = snapshot(true);
const SILVER = snapshot(true, [{ dueAt: iso(-120), answeredAt: iso(-180) }]);
const NONE = snapshot(false);
const PENDING = snapshot(true, [{ dueAt: iso(-120), answeredAt: iso(-180) }, { dueAt: iso(30) }]); // silver until an answer is due in 30 minutes

const logFile = () => join(folder, ".data", "seal-log.jsonl");
const lines = () => (existsSync(logFile()) ? readFileSync(logFile(), "utf8").trim().split("\n") : []);
const levels = async () => (await readLog()).map((e) => e.level);
const claimsOf = (token: string): SealClaims => JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
const publishedKey = async (): Promise<SealJwk> => (await (await keysRoute()).json()).keys[0];

let folder: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "constela-seal-"));
  vi.spyOn(process, "cwd").mockReturnValue(folder);
  vi.stubEnv("PUBLIC_API_WRITES", "on");
  vi.stubEnv("SEAL_SIGNING_KEY", undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(folder, { recursive: true, force: true });
});

describe("the seal history", () => {
  it("starts when a company first has a seal, and then adds only changes", async () => {
    await recordSeals(BRONZE, now);
    await recordSeals(BRONZE, at(1));
    expect(await readLog()).toEqual([expect.objectContaining({ seq: 0, at: now.toISOString(), company: "Ceiba Foods", level: "bronze", prev: GENESIS })]);
    await recordSeals(SILVER, at(2));
    await recordSeals(EMPTY_SNAPSHOT, at(3));
    await recordSeals(EMPTY_SNAPSHOT, at(4));
    expect(await levels()).toEqual(["bronze", "silver", null]);
  });

  it("writes nothing for a company without a seal, or for one it never heard of", async () => {
    await recordSeals(NONE, now);
    await recordSeals(BRONZE, now, "Some Other Company");
    expect(existsSync(logFile())).toBe(false);
  });

  it("records a drop caused by a date, the next time anyone asks", async () => {
    expect((await signedSeal(PENDING, "Ceiba Foods", now)).level).toBe("silver");
    expect((await signedSeal(PENDING, "Ceiba Foods", at(31))).level).toBe("bronze");
    expect((await readLog()).map((e) => [e.level, e.at])).toEqual([
      ["silver", now.toISOString()],
      ["bronze", iso(31)],
    ]);
  });

  it("writes each change once, even when many ask at the same moment", async () => {
    await signedSeal(PENDING, "Ceiba Foods", now);
    await Promise.all(Array.from({ length: 10 }, () => signedSeal(PENDING, "ceiba foods", at(31))));
    expect(await levels()).toEqual(["silver", "bronze"]);
  });

  it("holds a company, a level and a time, never anything about candidates", async () => {
    await recordSeals(SILVER, now);
    expect(Object.keys(JSON.parse(lines()[0]))).toEqual(["seq", "at", "company", "level", "prev", "hash"]);
    expect(readFileSync(logFile(), "utf8")).not.toMatch(/dueAt|answeredAt|candidate/);
  });

  it("passes the check a browser runs, and a hand edit shows exactly where", async () => {
    await recordSeals(BRONZE, now);
    await recordSeals(SILVER, at(1));
    await recordSeals(NONE, at(2));
    expect(await verifyChain(await readLog())).toEqual({ ok: true });

    const edited = lines().map((line, i) => (i === 1 ? line.replace('"silver"', '"gold"') : line));
    writeFileSync(logFile(), `${edited.join("\n")}\n`);
    expect(await verifyChain(await readLog())).toEqual({ ok: false, at: 1 });
  });

  it("is never extended or pointed to once it fails its own check, but the level still answers", async () => {
    await recordSeals(BRONZE, now);
    writeFileSync(logFile(), readFileSync(logFile(), "utf8").replace('"bronze"', '"silver"'));
    const before = readFileSync(logFile(), "utf8");
    expect(await signedSeal(SILVER, "Ceiba Foods", now)).toMatchObject({ level: "silver", token: null });
    await expect(recordSeals(NONE, now)).rejects.toThrow();
    expect(readFileSync(logFile(), "utf8")).toBe(before);
  });

  it("is unreadable when a line isn't an entry, rather than skipping it", async () => {
    await recordSeals(BRONZE, now);
    writeFileSync(logFile(), "not an entry\n", { flag: "a" });
    await expect(readLog()).rejects.toThrow();
    expect((await logRoute()).status).toBe(500);
    expect((await signedSeal(BRONZE, "Ceiba Foods", now)).token).toBeNull();
  });
});

describe("signed seals", () => {
  it("signs the seal of a company with job posts here, and the published key checks it", async () => {
    const answer = await signedSeal(SILVER, "ceiba foods", now);
    expect(answer).toMatchObject({ company: "Ceiba Foods", level: "silver", vacancyIds: [DEMO_VACANCY.id], token: expect.any(String) });
    const checked = await verifySeal(answer.token!, await publishedKey(), now);
    expect(checked).toEqual({ ok: true, value: expect.objectContaining({ iss: "constela", sub: "Ceiba Foods", level: "silver", vacancyIds: [DEMO_VACANCY.id], iat: seconds(now) }) });
  });

  it("points to the history as it was, which a later history must still hold", async () => {
    const { token } = await signedSeal(BRONZE, "Ceiba Foods", now);
    const { log } = claimsOf(token!);
    expect(log.size).toBe(1);
    await recordSeals(SILVER, at(1));
    expect(holdsHead(await readLog(), log)).toBe(true);
  });

  it("catches a history rewritten from scratch, links and all, with the head an old token signed", async () => {
    await recordSeals(SILVER, now);
    const { token } = await signedSeal(SILVER, "Ceiba Foods", at(1));
    const rewritten: LogEntry[] = [];
    for (const e of await readLog()) {
      const entry = { ...e, level: "gold" as const, prev: rewritten.at(-1)?.hash ?? GENESIS };
      rewritten.push({ ...entry, hash: await sha256(entryText(entry)) });
    }
    expect(await verifyChain(rewritten)).toEqual({ ok: true });
    expect(holdsHead(rewritten, claimsOf(token!).log)).toBe(false);
  });

  it("signs nothing, writes nothing and makes no key for a company it doesn't know", async () => {
    expect(await signedSeal(BRONZE, "Some Other Company", now)).toEqual({ company: "Some Other Company", level: null, vacancyIds: [], token: null });
    expect(existsSync(join(folder, ".data"))).toBe(false);
  });

  it("keeps saying a seal ended when someone asks about that company later", async () => {
    await recordSeals(BRONZE, now);
    await recordSeals(EMPTY_SNAPSHOT, at(1));
    expect(await signedSeal(EMPTY_SNAPSHOT, "Ceiba Foods", at(2))).toMatchObject({ level: null, token: null });
    expect(await levels()).toEqual(["bronze", null]);
  });

  it("never outlives the next promised answer date, nor an hour", async () => {
    expect(claimsOf((await signedSeal(PENDING, "Ceiba Foods", now)).token!).exp).toBe(seconds(at(30)));
    expect(claimsOf((await signedSeal(SILVER, "Ceiba Foods", now)).token!).exp).toBe(seconds(now) + TOKEN_SECONDS);
  });

  it("refuses the same token with a higher level written in", async () => {
    const { token } = await signedSeal(BRONZE, "Ceiba Foods", now);
    expect(await verifySeal(forge(token!, { level: "gold" }), await publishedKey(), now)).toEqual({ ok: false, why: "signature" });
  });

  it("signs with SEAL_SIGNING_KEY when it is set, so tokens stay checkable after a redeploy", async () => {
    // RFC 8037, appendix A, as a PKCS#8 PEM with its line breaks escaped, the way a host stores a variable.
    const x = "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo";
    const pem = createPrivateKey({ key: { kty: "OKP", crv: "Ed25519", d: "nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A", x }, format: "jwk" }).export({ type: "pkcs8", format: "pem" });
    vi.stubEnv("SEAL_SIGNING_KEY", String(pem).replace(/\n/g, "\\n"));
    expect(await publishedKey()).toEqual({ kty: "OKP", crv: "Ed25519", x, kid: thumbprint(x), alg: "EdDSA", use: "sig" });
    expect(existsSync(join(folder, ".data"))).toBe(false);
  });
});

describe("the routes", () => {
  it("publish the key and the history, readable from any site", async () => {
    await recordSeals(BRONZE, now);
    const keys = await keysRoute();
    const log = await logRoute();
    for (const res of [keys, log, keysOptions()]) expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const key = (await keys.json()).keys[0];
    expect(key.kid).toBe(thumbprint(key.x));
    const { size, head, entries } = await log.json();
    expect({ size, head }).toEqual({ size: 1, head: entries[0].hash });
  });

  it("show an empty history before any seal", async () => {
    expect(await (await logRoute()).json()).toEqual({ size: 0, head: GENESIS, entries: [] });
  });

  it("record what a sync changes, and that a deleted employer's seal ended", async () => {
    await PUT(new Request("http://localhost/api/employer-sync", { method: "PUT", body: JSON.stringify(BRONZE) }));
    await PUT(new Request("http://localhost/api/employer-sync", { method: "PUT", body: JSON.stringify(SILVER) }));
    await DELETE();
    expect(await levels()).toEqual(["bronze", "silver", null]);
  });
});
