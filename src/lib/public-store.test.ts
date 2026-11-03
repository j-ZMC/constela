import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPTIONS as sealOptions, GET as sealRoute } from "@/app/api/public/seal/route";
import { GET as vacancyRoute } from "@/app/api/public/vacancies/[id]/route";
import { DELETE, PUT } from "@/app/api/employer-sync/route";
import { MAX_SNAPSHOT_CHARS, publicSnapshot } from "@/lib/public-employer";
import { readSnapshot } from "@/lib/public-store";
import { DEMO_VACANCY } from "@/lib/vacancy";

// Windows refuses a rename while a reader has the file open. This makes the next renames fail that way.
const busy = vi.hoisted(() => ({ times: 0 }));
vi.mock("node:fs/promises", async (original) => {
  const fs = await original<typeof import("node:fs/promises")>();
  return {
    ...fs,
    rename: async (from: string, to: string) => {
      if (busy.times > 0) {
        busy.times--;
        throw Object.assign(new Error("busy"), { code: "EPERM" });
      }
      return fs.rename(from, to);
    },
  };
});

const SYNC = "http://localhost/api/employer-sync";
const body = JSON.stringify(publicSnapshot({ vacancies: [DEMO_VACANCY], guideRead: true, responses: [] }));
const put = (text = body) => PUT(new Request(SYNC, { method: "PUT", body: text }));
const seal = (query: string) => sealRoute(new Request(`http://localhost/api/public/seal${query}`));
const vacancy = (id: string) => vacancyRoute(new Request(`http://localhost/api/public/vacancies/${id}`), { params: Promise.resolve({ id }) });
const file = () => join(process.cwd(), ".data", "public-employer.json");

let folder: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "constela-public-"));
  vi.spyOn(process, "cwd").mockReturnValue(folder);
  vi.stubEnv("PUBLIC_API_WRITES", "on");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(folder, { recursive: true, force: true });
});

describe("the write route", () => {
  it("stays off outside npm run dev unless it is turned on", async () => {
    vi.stubEnv("PUBLIC_API_WRITES", "");
    vi.stubEnv("NODE_ENV", "production");
    expect((await put()).status).toBe(503);
    expect((await DELETE()).status).toBe(503);
    expect(await readSnapshot()).toEqual({ vacancies: [], guideRead: false, responses: [] });
  });

  it("is on in npm run dev, so the team needs no setup", async () => {
    vi.stubEnv("PUBLIC_API_WRITES", "");
    vi.stubEnv("NODE_ENV", "development");
    expect((await put()).status).toBe(204);
  });

  it("takes no other value as on", async () => {
    vi.stubEnv("PUBLIC_API_WRITES", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect((await put()).status).toBe(503);
  });

  it("stores what passes the check, and replaces the old copy", async () => {
    expect((await put()).status).toBe(204);
    expect((await readSnapshot()).vacancies.map((v) => v.id)).toEqual([DEMO_VACANCY.id]);
    await put(JSON.stringify({ vacancies: [], guideRead: false, responses: [] }));
    expect((await readSnapshot()).vacancies).toEqual([]);
  });

  it("leaves no temporary file behind and stores no level", async () => {
    await put();
    expect(readdirSync(join(folder, ".data"))).toEqual(["public-employer.json"]);
    const stored = readFileSync(file(), "utf8");
    expect(JSON.parse(stored)).not.toHaveProperty("level");
    expect(stored).not.toContain("bronze");
  });

  it("refuses broken JSON, a draft and a candidate id, and keeps the old copy", async () => {
    await put();
    expect((await put("not json")).status).toBe(400);
    expect((await put(JSON.stringify({ vacancies: [{ ...DEMO_VACANCY, status: "draft" }], guideRead: true, responses: [] }))).status).toBe(400);
    expect((await put(JSON.stringify({ vacancies: [], guideRead: true, responses: [{ dueAt: new Date().toISOString(), candidateId: "c-1042" }] }))).status).toBe(400);
    expect((await readSnapshot()).vacancies).toHaveLength(1);
  });

  it("refuses a body that is too long, even valid JSON, before reading it", async () => {
    expect((await put(body + " ".repeat(MAX_SNAPSHOT_CHARS))).status).toBe(400);
    expect((await readSnapshot()).vacancies).toEqual([]);
  });

  it("waits out a reader that has the file open", async () => {
    await put();
    busy.times = 3;
    const empty = JSON.stringify({ vacancies: [], guideRead: false, responses: [] });
    expect((await put(empty)).status).toBe(204);
    expect((await readSnapshot()).vacancies).toEqual([]);
  });

  it("gives up after about a second, keeps the old copy and leaves no temporary file", async () => {
    await put();
    busy.times = 1000;
    expect((await put(JSON.stringify({ vacancies: [], guideRead: false, responses: [] }))).status).toBe(500);
    busy.times = 0;
    expect((await readSnapshot()).vacancies).toHaveLength(1);
    expect(readdirSync(join(folder, ".data"))).toEqual(["public-employer.json"]);
  });

  it("says so when the server can't save", async () => {
    writeFileSync(join(folder, ".data"), "a file where the folder should go");
    const res = await put();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "failed" });
  });

  it("removes the copy on delete, even when there is none", async () => {
    await put();
    expect((await DELETE()).status).toBe(204);
    expect((await readSnapshot()).vacancies).toEqual([]);
    expect((await DELETE()).status).toBe(204);
  });
});

describe("readSnapshot", () => {
  it("shows nothing rather than trusting a broken or edited file", async () => {
    await put();
    writeFileSync(file(), "{ broken");
    expect((await readSnapshot()).vacancies).toEqual([]);
    writeFileSync(file(), JSON.stringify({ vacancies: [{ ...DEMO_VACANCY, status: "draft" }], guideRead: true, responses: [] }));
    expect((await readSnapshot()).vacancies).toEqual([]);
  });
});

describe("the public routes", () => {
  it("lets any site read them, on every answer", async () => {
    await put();
    for (const res of [await seal("?company=Ceiba%20Foods"), await seal(""), await vacancy(DEMO_VACANCY.id), await vacancy("v-unknown"), sealOptions()]) {
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
    }
    expect(sealOptions().status).toBe(204);
  });

  it("offers reading only", () => {
    expect(sealOptions().headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
  });

  it("answers the seal of a company, worked out from the stored data", async () => {
    await put();
    expect(await (await seal("?company=ceiba%20foods")).json()).toEqual({ company: "Ceiba Foods", level: "bronze", vacancyIds: [DEMO_VACANCY.id] });
  });

  it("needs a company of a sensible length", async () => {
    expect((await seal("")).status).toBe(400);
    expect((await seal("?company=%20%20")).status).toBe(400);
    expect((await seal(`?company=${"a".repeat(81)}`)).status).toBe(400);
  });

  it("treats an unknown company as a normal answer", async () => {
    const res = await seal("?company=Other");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ company: "Other", level: null, vacancyIds: [] });
  });

  it("gives the card of a published job post, and not_found for the rest", async () => {
    await put();
    expect(await (await vacancy(DEMO_VACANCY.id)).json()).toMatchObject({ id: DEMO_VACANCY.id, title: "Junior Data Analyst" });
    const missing = await vacancy("v-unknown");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "not_found" });
  });
});
