import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));

const { POST } = await import("@/app/api/jobs/posting/route");
const { postingText, privateAddress } = await import("@/lib/job-posting");

const openai = (value: object) =>
  new Response(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] }));
const page = `<html><body><nav>Menu</nav><h1>Support intern</h1><p>${"You will help people with laptops. ".repeat(12)}</p>
<p>Requirements: 1+ years of IT support.</p><script>var x = "noise"</script></body></html>`;
const post = (body: unknown) => POST(new Request("http://localhost/api/jobs/posting", { method: "POST", body: JSON.stringify(body) }));

describe("job posting", () => {
  it("knows which addresses are inside the computer or its network", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.9", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1"]) {
      expect(privateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["104.18.0.1", "8.8.8.8", "2606:4700::1111"]) expect(privateAddress(ip), ip).toBe(false);
  });

  it("reads a JobPosting from JSON-LD when the page builds itself with JavaScript", () => {
    const html = `<div id="app"></div><script type="application/ld+json">${JSON.stringify({
      "@type": "JobPosting",
      description: `<p>${"Build data tools. ".repeat(20)}</p>`,
      experienceRequirements: { "@type": "OccupationalExperienceRequirements", description: "3+ years with SQL" },
    })}</script>`;
    const text = postingText(html);
    expect(text).toContain("Build data tools.");
    expect(text).toContain("3+ years with SQL");
    expect(postingText(page)).not.toContain("noise");
  });
});

describe("POST /api/jobs/posting", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    fetchMock.mockReset();
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: "104.18.0.1" }]);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reads the job's page and returns what it asks for", async () => {
    fetchMock.mockResolvedValueOnce(new Response(page)).mockResolvedValueOnce(openai({ required: ["1+ years of IT support"], nice: [] }));
    const res = await post({ url: "https://jobs.example.com/1", title: "Support intern" });
    expect(await res.json()).toMatchObject({ required: ["1+ years of IT support"], nice: [], from: "page" });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).input).toContain("1+ years of IT support");
  });

  it("never opens an address inside the network, and uses the saved text instead", async () => {
    lookupMock.mockResolvedValue([{ address: "10.0.0.5" }]);
    fetchMock.mockResolvedValueOnce(openai({ required: ["A driver's license"], nice: [] }));
    const res = await post({ url: "http://intranet.example/", description: "You need a driver's license." });
    expect((await res.json()).from).toBe("saved");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/v1/responses");
  });

  it("checks every redirect too", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "104.18.0.1" }]).mockResolvedValueOnce([{ address: "127.0.0.1" }]);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://localhost:3000/admin" } }))
      .mockResolvedValueOnce(openai({ required: [], nice: [] }));
    const res = await post({ url: "https://jobs.example.com/1", description: "Some saved text." });
    expect((await res.json()).from).toBe("saved");
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).not.toContain("http://localhost:3000/admin");
  });

  it("rejects links that are not web links", async () => {
    expect((await post({ url: "file:///etc/passwd" })).status).toBe(502);
    expect((await post({ url: "not a url" })).status).toBe(400);
  });
});
