import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SiteNav } from "@/components/site-nav";

const route = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));

const CANDIDATE_PAGES = ["/profile", "/plan", "/recommended", "/jobs", "/interview"];
const EMPLOYER_PAGES = ["/employers", "/employers/vacancies", "/employers/talent", "/employers/guide"];

function render(path: string) {
  route.path = path;
  const html = renderToStaticMarkup(createElement(SiteNav));
  const links = [...html.matchAll(/<a\b[^>]*>/g)].map(([tag]) => ({ href: /href="([^"]*)"/.exec(tag)?.[1], current: tag.includes('aria-current="page"') }));
  return { html, hrefs: new Set(links.map((l) => l.href)), current: new Set(links.filter((l) => l.current).map((l) => l.href)) };
}

describe("SiteNav", () => {
  it.each(EMPLOYER_PAGES)("shows only the employer menu on %s", (path) => {
    const { hrefs } = render(path);
    expect([...hrefs].sort()).toEqual([...EMPLOYER_PAGES].sort());
  });

  it.each(CANDIDATE_PAGES)("shows only the candidate menu on %s", (path) => {
    const { hrefs } = render(path);
    expect([...hrefs].sort()).toEqual(["/", ...CANDIDATE_PAGES].sort());
  });

  it("shows no menu on the intro, only the way home", () => {
    expect([...render("/").hrefs]).toEqual(["/"]);
  });

  it("names the employer side, and only there", () => {
    expect(render("/employers").html).toContain("for Employers");
    expect(render("/jobs").html).not.toContain("for Employers");
  });

  it("marks only the current page, so Overview isn't current on the other employer pages", () => {
    expect([...render("/employers").current]).toEqual(["/employers"]);
    expect([...render("/employers/talent").current]).toEqual(["/employers/talent"]);
    expect([...render("/jobs").current]).toEqual(["/jobs"]);
  });
});
