import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/learn/search/route";
import { academyOf, courseSearchRequest, searchCourses } from "@/lib/course-search";
import type { Resource } from "@/lib/learn-resources";

const res = (id: string, url: string, title: string, skills: string[] = []): Resource => ({
  id, title, provider: "Provider", url, kind: "course", cost: "free", format: "self-paced", areas: ["software"], skills, about: `About ${title}.`,
});
const list = [
  res("claude", "https://anthropic.skilljar.com/claude-code-101", "Claude Code 101", ["ai"]),
  res("aws-cloud", "https://skillbuilder.aws/cloud-practitioner", "Cloud Practitioner", ["cloud"]),
  res("aws-ai", "https://skillbuilder.aws/ai-basics", "AI basics on AWS", ["ai"]),
  res("blog", "https://some-blog.example/ai", "A blog about AI", ["ai"]),
];
const parse = (body: object) => courseSearchRequest.parse(body);

describe("company course search", () => {
  it("knows which links are on a company's official course site", () => {
    expect(academyOf("https://anthropic.skilljar.com/claude-code-101", ["Anthropic"])).toBe("Anthropic");
    expect(academyOf("https://explore.skillbuilder.aws/learn", [])).toBe("AWS");
    expect(academyOf("https://anthropic.skilljar.com.evil.example/x", ["Anthropic"])).toBeNull();
    expect(academyOf("https://skillbuilder.aws/learn", ["Anthropic"])).toBeNull();
  });

  it("shows every course of a chosen company, the closest to the topic first", () => {
    const { courses } = searchCourses(parse({ topic: "ai basics", companies: ["AWS"] }), list);
    expect(courses.map((c) => c.title)).toEqual(["AI basics on AWS", "Cloud Practitioner"]);
    expect(courses[0]).toMatchObject({ company: "AWS", cost: "free", url: "https://skillbuilder.aws/ai-basics" });
  });

  it("with no company chosen, only courses that match the topic, and never other sites", () => {
    const titles = searchCourses(parse({ topic: "AI" }), list).courses.map((c) => c.title);
    expect(titles).toEqual(["Claude Code 101", "AI basics on AWS"]);
    expect(searchCourses(parse({ topic: "gardening" }), list).courses).toEqual([]);
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
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("answers from the hand-checked list, without sending anything anywhere", async () => {
    const res = await post({ topic: "cloud", companies: ["AWS"] });
    expect(res.status).toBe(200);
    expect((await res.json()).courses.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await post({ topic: "" })).status).toBe(400);
  });
});
