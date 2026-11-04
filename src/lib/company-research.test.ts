import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/company/research/route";
import { companyResearch, parseResearch, researchPrompt, researchRequest, wikipediaPage } from "@/lib/company-research";

const now = new Date("2026-11-02T10:00:00Z");
const page = { title: "Datadog", url: "https://en.wikipedia.org/wiki/Datadog", content: "Datadog is a monitoring and security platform." };
const lines = ["- What it does: A monitoring platform.", "**Interviews:** Not found.", "Some closing words without a label"];
const json = (value: unknown) => new Response(JSON.stringify(value));
const answer = (value: object) => json({ message: { role: "assistant", content: JSON.stringify(value) } });
const search = (title?: string) => json({ query: { search: title ? [{ title }] : [] } });
const extract = (text: string) => json({ query: { pages: [{ extract: text }] } });

describe("company research", () => {
  it("keeps the labeled lines, and the Wikipedia page as its source", () => {
    const result = parseResearch({ lines, used: [1, 9] }, [page], now);
    expect(result.facts).toEqual(["What it does: A monitoring platform.", "Interviews: Not found."]);
    expect(result.sources).toEqual([{ site: "en.wikipedia.org", url: "https://en.wikipedia.org/wiki/Datadog" }]);
    expect(companyResearch.safeParse(result).success).toBe(true);
  });

  it("fails when the model found nothing it could label", () => {
    expect(() => parseResearch({ lines: [] }, [page], now)).toThrow("failed");
    expect(() => parseResearch(null, [page], now)).toThrow("failed");
  });

  it("sends only the company name to Wikipedia, and quotes names in the prompt", () => {
    const request = researchRequest.parse({ company: "Engine", title: "Intern", location: "Chicago" });
    expect(researchPrompt(request, [page])).toContain('"Engine" (it is hiring for "Intern" in Chicago)');
    expect(researchPrompt(request, [page])).toContain("[1] Datadog");
    expect(researchRequest.safeParse({ company: "Engine", email: "a@b.c" }).success).toBe(false);
  });
});

describe("POST /api/company/research", () => {
  const fetchMock = vi.fn();
  const post = (body: unknown) => POST(new Request("http://localhost/api/company/research", { method: "POST", body: JSON.stringify(body) }));
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads Wikipedia without a key and answers with the model on this computer", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const u = String(url);
      if (u.includes("list=search")) return search("Datadog");
      if (u.includes("prop=extracts")) return extract(page.content);
      return answer({ lines, used: [1] });
    });
    const res = await post({ company: "Datadog", title: "Intern", location: "Boston" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ sources: [{ site: "en.wikipedia.org" }] });
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.startsWith("https://en.wikipedia.org/w/api.php") && u.includes("Datadog") && !u.includes("Intern") && !u.includes("Boston"))).toBe(true);
    expect(urls).toContain("http://127.0.0.1:11434/api/chat");
  });

  it("says when there is nothing to read, or the request is wrong", async () => {
    expect((await post({ company: "" })).status).toBe(400);
    fetchMock.mockResolvedValue(search());
    expect((await post({ company: "Nobody Inc" })).status).toBe(502);
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    expect((await post({ company: "Datadog" })).status).toBe(502);
  });

  it("finds no page when Wikipedia has no article", async () => {
    fetchMock.mockResolvedValue(search());
    expect(await wikipediaPage("Nobody Inc")).toBeNull();
  });
});
