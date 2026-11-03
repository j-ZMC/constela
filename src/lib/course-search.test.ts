import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/learn/search/route";
import { academyOf, cleanResults, courseSearchRequest, domainsFor } from "@/lib/course-search";

const answer = (courses: object[]) =>
  new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ courses }) }] }] }));
const course = (url: string, company = "Anthropic") => ({ title: "Claude Code 101", company, url, cost: "free", about: "Learn the basics." });

describe("company course search", () => {
  it("knows which links are on a company's official course site", () => {
    expect(academyOf("https://anthropic.skilljar.com/claude-code-101", ["Anthropic"])).toBe("Anthropic");
    expect(academyOf("https://explore.skillbuilder.aws/learn", [])).toBe("AWS");
    expect(academyOf("https://anthropic.skilljar.com.evil.example/x", ["Anthropic"])).toBeNull();
    expect(academyOf("https://skillbuilder.aws/learn", ["Anthropic"])).toBeNull();
    expect(domainsFor(["Anthropic"])).toEqual(["anthropic.skilljar.com", "academy.claude.com"]);
  });

  it("keeps only courses on the chosen sites, once each, without tracking", () => {
    const { courses } = cleanResults(
      { courses: [
        course("https://anthropic.skilljar.com/claude-code-101?utm_source=openai"),
        course("https://anthropic.skilljar.com/claude-code-101"),
        course("https://some-blog.example/claude-course"),
        course("http://academy.claude.com/x"),
        { title: 5 },
      ] },
      ["Anthropic"],
    );
    expect(courses).toEqual([{ ...course("https://anthropic.skilljar.com/claude-code-101") }]);
  });

  it("accepts only a short topic and known companies", () => {
    expect(courseSearchRequest.safeParse({ topic: "AI agents", companies: ["AWS"] }).success).toBe(true);
    expect(courseSearchRequest.safeParse({ topic: "AI", companies: ["Evil Corp"] }).success).toBe(false);
    expect(courseSearchRequest.safeParse({ topic: "x" }).success).toBe(false);
    expect(courseSearchRequest.safeParse({ topic: "AI agents", email: "a@b.c" }).success).toBe(false);
  });
});

describe("POST /api/learn/search", () => {
  const fetchMock = vi.fn();
  const post = (body: unknown) => POST(new Request("http://localhost/api/learn/search", { method: "POST", body: JSON.stringify(body) }));
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("searches only the chosen company's official sites", async () => {
    fetchMock.mockResolvedValue(answer([course("https://anthropic.skilljar.com/claude-code-101")]));
    const res = await post({ topic: "AI agents", companies: ["Anthropic"] });
    expect((await res.json()).courses).toHaveLength(1);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.tools).toEqual([{ type: "web_search", filters: { allowed_domains: ["anthropic.skilljar.com", "academy.claude.com"] } }]);
    expect(sent.input).toContain('"AI agents"');
  });

  it("says what went wrong", async () => {
    expect((await post({ topic: "" })).status).toBe(400);
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    expect((await post({ topic: "cloud basics" })).status).toBe(502);
    vi.stubEnv("OPENAI_API_KEY", "");
    expect((await post({ topic: "cloud basics" })).status).toBe(503);
  });
});
