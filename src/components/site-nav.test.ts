import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EmployerNav } from "@/components/employers/employer-nav";
import { SiteNav } from "@/components/site-nav";

const route = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));

const CANDIDATE_PAGES = ["/profile", "/plan", "/jobs", "/interview"];
const EMPLOYER_PAGES = ["/employers", "/employers/vacancies", "/employers/talent", "/employers/seal", "/employers/guide"];

function render(nav: () => React.ReactNode, path: string) {
  route.path = path;
  const html = renderToStaticMarkup(createElement(nav));
  const links = [...html.matchAll(/<a\b[^>]*>/g)].map(([tag]) => ({ href: /href="([^"]*)"/.exec(tag)?.[1], current: tag.includes('aria-current="page"') }));
  return { html, hrefs: new Set(links.map((l) => l.href)), current: new Set(links.filter((l) => l.current).map((l) => l.href)) };
}

describe("SiteNav", () => {
  it.each(CANDIDATE_PAGES)("shows only the candidate menu on %s", (path) => {
    const { hrefs } = render(SiteNav, path);
    expect([...hrefs].sort()).toEqual(["/", ...CANDIDATE_PAGES].sort());
  });

  it("shows no menu on the intro, only the way home", () => {
    expect([...render(SiteNav, "/").hrefs]).toEqual(["/"]);
  });

  it.each(EMPLOYER_PAGES)("shows nothing on %s, because employers have their own menu", (path) => {
    expect(render(SiteNav, path).html).toBe("");
  });

  it("marks only the current page", () => {
    expect([...render(SiteNav, "/jobs").current]).toEqual(["/jobs"]);
  });
});

describe("EmployerNav", () => {
  it.each(EMPLOYER_PAGES)("shows only the employer menu on %s", (path) => {
    expect([...render(EmployerNav, path).hrefs].sort()).toEqual([...EMPLOYER_PAGES].sort());
  });

  it("names the employer side", () => {
    expect(render(EmployerNav, "/employers").html).toContain("for Employers");
  });

  it("marks only the current page, so Home isn't current on the other employer pages", () => {
    expect([...render(EmployerNav, "/employers").current]).toEqual(["/employers"]);
    expect([...render(EmployerNav, "/employers/talent").current]).toEqual(["/employers/talent"]);
  });

  it("marks the seal as current on its own page", () => {
    expect([...render(EmployerNav, "/employers/seal").current]).toEqual(["/employers/seal"]);
  });
});
