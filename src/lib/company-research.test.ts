import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/company/research/route";
import { companyResearch, parseResearch, researchPrompt, researchRequest } from "@/lib/company-research";

const now = new Date("2026-11-02T10:00:00Z");
const answer = {
  output: [
    { type: "web_search_call" },
    {
      type: "message",
      content: [{
        type: "output_text",
        text:
          "- What it does: A monitoring platform. ([datadoghq.com](https://www.datadoghq.com/?utm_source=openai))  \n\n" +
          "- **Interviews:** A screen, then [panel](https://x.example) rounds.\n" +
          "Some closing words without a label",
        annotations: [
          { type: "url_citation", url: "https://www.datadoghq.com/?utm_source=openai" },
          { type: "url_citation", url: "https://www.datadoghq.com/?utm_source=openai" },
          { type: "url_citation", url: "javascript:alert(1)" },
        ],
      }],
    },
  ],
};

describe("company research", () => {
  it("keeps the labeled lines without citations, and each web source once", () => {
    const result = parseResearch(answer, now);
    expect(result.facts).toEqual(["What it does: A monitoring platform.", "Interviews: A screen, then panel rounds."]);
    expect(result.sources).toEqual([{ site: "datadoghq.com", url: "https://www.datadoghq.com/" }]);
    expect(companyResearch.safeParse(result).success).toBe(true);
  });

  it("fails when the model found nothing it could label", () => {
    expect(() => parseResearch({ output: [] }, now)).toThrow("failed");
  });

  it("sends only the company, job title and place, quoted as names", () => {
    const request = researchRequest.parse({ company: "Engine", title: "Intern", location: "Chicago" });
    expect(researchPrompt(request)).toContain('"Engine" (it is hiring for "Intern" in Chicago)');
    expect(researchRequest.safeParse({ company: "Engine", email: "a@b.c" }).success).toBe(false);
  });
});

describe("POST /api/company/research", () => {
  const fetchMock = vi.fn();
  const post = (body: unknown) => POST(new Request("http://localhost/api/company/research", { method: "POST", body: JSON.stringify(body) }));
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("asks OpenAI to search the web and returns the facts", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(answer)));
    const res = await post({ company: "Datadog" });
    expect(res.status).toBe(200);
    expect((await res.json()).facts).toHaveLength(2);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toMatchObject({ model: "gpt-5-mini", tools: [{ type: "web_search" }] });
  });

  it("says what went wrong", async () => {
    expect((await post({ company: "" })).status).toBe(400);
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    expect((await post({ company: "Datadog" })).status).toBe(502);
    vi.stubEnv("OPENAI_API_KEY", "");
    expect((await post({ company: "Datadog" })).status).toBe(503);
  });
});
