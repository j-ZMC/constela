"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Building2, Check, ExternalLink, Library, Plus, Sparkles } from "lucide-react";
import { Loading } from "@/components/loading";
import { CARD, FilterGroup, FiltersToggle, GRID, GRID_WIDE, Pager, SIDEBAR, pageCount, pageOf, sidebarLayout } from "@/components/paged-grid";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ACADEMIES, courseResults, type Academy, type CourseResults } from "@/lib/course-search";
import { NO_LEARN_FILTERS, countLearn, loadLearnFilters, matchesLearn, recommend, saveLearnFilters, type LearnFilters, type SkillGap } from "@/lib/learn";
import { AREAS, COSTS, FORMATS, KINDS, RESOURCES, type Resource } from "@/lib/learn-resources";
import { loadResumeProfile } from "@/lib/local-profile";
import { addStepToPlan, loadPlan } from "@/lib/plan";
import { jobKey, useSavedJobs } from "@/lib/saved-jobs";
import { useHydrated } from "@/lib/use-hydrated";
import { useSingleFlight } from "@/lib/use-single-flight";
import { cn } from "@/lib/utils";

const select =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring";
// Twelve cards fill two columns evenly.
const PAGE = 12;

// "sql" reads as SQL, "power bi" as Power BI, "python" as Python.
const pretty = (skill: string) => skill.split(" ").map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join(" ");
const jobs = (n: number) => `${n} saved ${n === 1 ? "job" : "jobs"}`;
const planTitle = (title: string) => `Start: ${title}`.slice(0, 80);

// Saved jobs and the CV live in localStorage, so render only after hydration.
export function LearnView() {
  return useHydrated() ? <View /> : <Loading />;
}

function View() {
  const saved = useSavedJobs();
  // Saved shows "Courses for what this job asks", which opens /learn?job=<its key>.
  const askedJob = useSearchParams().get("job");
  const focus = askedJob ? saved.find((s) => jobKey(s.job) === askedJob) : undefined;
  const [cv] = useState(() => loadResumeProfile()?.skills_found ?? []);
  const forYou = useMemo(() => recommend(focus ? [focus] : saved, cv), [focus, saved, cv]);

  // Titles already waiting in My plan, so "Add to my plan" says so instead of adding twice. The ref catches a
  // double tap before React draws again.
  const [planned, setPlanned] = useState(() => new Set(loadPlan().steps.filter((s) => !s.done).map((s) => s.title)));
  const adding = useRef(new Set<string>());
  function addToPlan(title: string) {
    const step = planTitle(title);
    if (planned.has(step) || adding.current.has(step)) return;
    adding.current.add(step);
    addStepToPlan({ title: step, minutes: 20, icon: "list", href: "/learn", stage: "learn" });
    setPlanned((set) => new Set(set).add(step));
  }
  const plan = { planned: (title: string) => planned.has(planTitle(title)), add: addToPlan };

  // Three tabs instead of one long page, like a shop: everything, picks for you, and company courses.
  // "Courses for what this job asks" (?job=) opens the picks; the page stays mounted, so a new ?job= switches too.
  const [tab, setTab] = useState(() => (askedJob ? "for-you" : "all"));
  const [lastAsked, setLastAsked] = useState(askedJob);
  if (askedJob !== lastAsked) {
    setLastAsked(askedJob);
    if (askedJob) setTab("for-you");
  }

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
      <TabsList aria-label="Ways to learn" className="max-w-xl">
        <TabsTrigger value="all">All courses</TabsTrigger>
        <TabsTrigger value="for-you">Picked for you</TabsTrigger>
        <TabsTrigger value="company">Company courses</TabsTrigger>
      </TabsList>
      {/* keepMounted: changing tabs keeps filters, the page and a company search. */}
      <TabsPanel value="all" keepMounted><AllResources plan={plan} /></TabsPanel>
      <TabsPanel value="for-you" keepMounted>
        <ForYou saved={saved.length} focus={focus} missing={askedJob !== null && !focus} hasCv={cv.length > 0} gaps={forYou.gaps} picks={forYou.picks} plan={plan} />
      </TabsPanel>
      <TabsPanel value="company" keepMounted><CompanySearch plan={plan} /></TabsPanel>
    </Tabs>
  );
}

type Plan = { planned: (title: string) => boolean; add: (title: string) => void };

function ForYou({ saved, focus, missing, hasCv, gaps, picks, plan }: {
  saved: number;
  focus?: { job: { title: string; company: string } };
  missing: boolean;
  hasCv: boolean;
  gaps: SkillGap[];
  picks: { resource: Resource; skills: SkillGap[] }[];
  plan: Plan;
}) {
  const heading = focus ? `For ${focus.job.title} at ${focus.job.company}` : "Picked for your saved jobs";
  return (
    <section aria-labelledby="for-you" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="for-you" className="flex items-center gap-2 text-xl font-semibold text-balance"><Sparkles aria-hidden className="size-6 shrink-0 text-primary" />{heading}</h2>
        {focus && <Link href="/learn" className="flex min-h-11 w-fit items-center font-medium underline underline-offset-4">See picks for all my saved jobs</Link>}
        {missing && <p className="text-muted-foreground">That saved job is not on this device any more, so these are for all your saved jobs.</p>}
      </div>
      {saved === 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
          <p>Save jobs you like, and we suggest courses for what they ask.</p>
          <Link href="/jobs" className={buttonVariants({ className: "w-fit" })}>Find jobs</Link>
        </div>
      ) : gaps.length === 0 ? (
        <p className="rounded-xl border bg-card p-5">
          {focus ? "This job" : "Your saved jobs"} do not name a skill we have courses for yet{hasCv ? ", or your CV already shows it" : ""}. Look in All courses, or search Company courses.
        </p>
      ) : (
        <>
          <p className="text-pretty">
            {focus ? "It asks for" : "They ask for"} {gaps.slice(0, 6).map((g) => (focus ? pretty(g.skill) : `${pretty(g.skill)} (${g.jobs})`)).join(", ")}
            {hasCv ? ", which your CV does not show yet." : "."}
          </p>
          <ul aria-label="Picked for you" className={GRID_WIDE}>
            {picks.map(({ resource, skills }) => (
              <ResourceRow
                key={resource.id}
                resource={resource}
                reason={`For ${skills.map((s) => (focus ? pretty(s.skill) : `${pretty(s.skill)}, in ${jobs(s.jobs)}`)).join("; ")}`}
                plan={plan}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ResourceRow({ resource: r, reason, plan }: { resource: Resource; reason?: string; plan: Plan }) {
  const meta = [COSTS[r.cost], FORMATS[r.format], r.students ? "For college students" : ""].filter(Boolean);
  return (
    <li className={cn(CARD, "flex flex-col gap-3 p-5")}>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{r.provider} · {KINDS[r.kind]}</p>
        <h3 className="text-lg font-semibold leading-snug text-balance">{r.title}</h3>
        {reason && <p className="text-sm font-medium text-primary">{reason}</p>}
      </div>
      <p className="text-pretty">{r.about}</p>
      <ul aria-label="Details" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
        {meta.map((m) => <li key={m}>{m}</li>)}
      </ul>
      {r.note && <p className="text-sm text-muted-foreground">{r.note}</p>}
      <Actions url={r.url} title={r.title} plan={plan} />
    </li>
  );
}

function Actions({ url, title, plan }: { url: string; title: string; plan: Plan }) {
  const inPlan = plan.planned(title);
  return (
    <div className="mt-auto flex flex-wrap gap-2 pt-1">
      <a href={url} target="_blank" rel="noreferrer" aria-label={`Open the site: ${title}, in a new tab`} className={buttonVariants({ variant: "outline" })}>
        Open the site <ExternalLink aria-hidden className="size-4" />
      </a>
      <Button type="button" variant={inPlan ? "secondary" : "ghost"} aria-label={inPlan ? `In your plan: ${title}` : `Add to my plan: ${title}`} disabled={inPlan} onClick={() => plan.add(title)}>
        {inPlan ? <Check aria-hidden /> : <Plus aria-hidden />}
        {inPlan ? "In your plan" : "Add to my plan"}
      </Button>
    </div>
  );
}

const SEARCH_ERRORS: Record<string, string> = {
  invalid_input: "Type what you want to learn, in a few words.",
  not_configured: "Searching company courses is not set up on this computer yet. It is not your fault.",
  timeout: "The search took too long. Try again in a moment.",
  failed: "We can't search company courses right now. It is not your fault. Try again in a moment.",
};
const COST_WORDS = { free: "Free", paid: "Paid", unknown: "Check the price on the site" } as const;

// Courses from these companies' official sites, from the hand-checked list (course-search.ts). Nothing is sent anywhere.
function CompanySearch({ plan }: { plan: Plan }) {
  const [topic, setTopic] = useState("");
  const [company, setCompany] = useState<"" | Academy>("");
  const [results, setResults] = useState<CourseResults["courses"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const once = useSingleFlight();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (topic.trim().length < 2) return setProblem(SEARCH_ERRORS.invalid_input);
    // A double tap must not search twice.
    void once(async () => {
      setBusy(true);
      setProblem("");
      try {
        const res = await fetch("/api/learn/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ topic: topic.trim().slice(0, 80), companies: company ? [company] : [] }),
        });
        const data: unknown = await res.json().catch(() => null);
        const parsed = courseResults.safeParse(data);
        if (res.ok && parsed.success) setResults(parsed.data.courses);
        else setProblem(SEARCH_ERRORS[(data as { error?: string } | null)?.error ?? ""] ?? SEARCH_ERRORS.failed);
      } catch {
        setProblem("Could not reach Constela. Check your connection and try again.");
      } finally {
        setBusy(false);
      }
    });
  }

  const names = Object.keys(ACADEMIES) as Academy[];
  return (
    <section aria-labelledby="company-courses" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="company-courses" className="flex items-center gap-2 text-xl font-semibold"><Building2 aria-hidden className="size-6 shrink-0 text-primary" />Search company courses</h2>
        <p className="text-pretty text-muted-foreground">Courses made by the companies whose tools jobs ask for: {names.join(", ")}.</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
          <label className="flex flex-col gap-1 text-sm font-medium">
            What do you want to learn?
            <Input value={topic} maxLength={80} onChange={(e) => setTopic(e.target.value)} placeholder="For example, AI agents or cloud basics" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            From
            <select value={company} onChange={(e) => setCompany(e.target.value as "" | Academy)} className={select}>
              <option value="">Any of these companies</option>
              {names.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <Button type="submit" disabled={busy} className="w-fit">{busy ? "Searching…" : "Search company courses"}</Button>
        <p className="text-sm text-muted-foreground">
          Courses from these companies&apos; official sites, checked by hand. Nothing is sent anywhere.{" "}
          <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4">How we keep your data private</Link>
        </p>
      </form>
      {problem && <p role="alert" className="rounded-lg border border-destructive/30 bg-card p-4 text-sm">{problem}</p>}
      {busy && <p role="status" className="text-muted-foreground">Looking at the course sites…</p>}
      {results && !busy && (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p className="text-sm text-muted-foreground">
            {results.length ? `${results.length} ${results.length === 1 ? "course" : "courses"} found. Prices and dates can change; check each page.` : "No courses found for that. Try other words, or any company."}
          </p>
          {results.length > 0 && (
            <ul aria-label="Company courses" className={GRID_WIDE}>
              {results.map((c) => (
                <li key={c.url} className={cn(CARD, "flex flex-col gap-3 p-5")}>
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-muted-foreground">{c.company} · Course</p>
                    <h3 className="text-lg font-semibold leading-snug text-balance">{c.title}</h3>
                  </div>
                  {c.about && <p className="text-pretty">{c.about}</p>}
                  <p className="text-sm text-muted-foreground">{COST_WORDS[c.cost]}</p>
                  <Actions url={c.url} title={c.title} plan={plan} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

const CHOICES = {
  area: { label: "Area", all: "Any area", options: AREAS },
  kind: { label: "Type", all: "Any type", options: KINDS },
  cost: { label: "Cost", all: "Any cost", options: COSTS },
  format: { label: "How you take it", all: "Any way", options: FORMATS },
} as const;

function AllResources({ plan }: { plan: Plan }) {
  const [filters, setFilters] = useState<LearnFilters>(loadLearnFilters);
  const [page, setPage] = useState(1);
  // On phones the filters wait behind a button, so the courses come first.
  const [showFilters, setShowFilters] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const found = RESOURCES.filter((r) => matchesLearn(r, filters));
  const names = Object.keys(CHOICES) as (keyof typeof CHOICES)[];
  const chosen = names.filter((n) => filters[n] !== "all").length + (filters.students ? 1 : 0);
  const on = JSON.stringify(filters) !== JSON.stringify(NO_LEARN_FILTERS);
  const pages = pageCount(found.length, PAGE);

  function change(next: LearnFilters) {
    setFilters(next);
    saveLearnFilters(next);
    setPage(1);
  }

  function go(next: number) {
    setPage(next);
    top.current?.scrollIntoView({ block: "start" });
  }

  return (
    <section aria-labelledby="all-resources" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="all-resources" className="flex items-center gap-2 text-xl font-semibold"><Library aria-hidden className="size-6 shrink-0 text-primary" />All courses and resources</h2>
        <p className="text-pretty text-muted-foreground">Checked by hand. Prices can change, so check the site.</p>
      </div>
      {/* Like a shop: filters on the left with how many each one leaves, search and results on the right, a page at a time. */}
      <div className={sidebarLayout(showFilters)}>
        {showFilters && (
        <aside aria-label="Filters" className={SIDEBAR}>
          {names.map((name) => (
            <FilterGroup
              key={name}
              id={`learn-${name}`}
              label={CHOICES[name].label}
              value={filters[name] as string}
              options={([["all", CHOICES[name].all], ...Object.entries(CHOICES[name].options)] as [string, string][]).map(([v, text]) => [v, text, countLearn(filters, name, v as never)])}
              onChange={(v) => change({ ...filters, [name]: v })}
            />
          ))}
          <label className="flex min-h-11 items-center gap-2 px-3 text-sm font-medium">
            <Checkbox checked={filters.students} onCheckedChange={(checked) => change({ ...filters, students: checked === true })} />
            Only for college students
          </label>
          {on && <Button type="button" variant="outline" onClick={() => change(NO_LEARN_FILTERS)}>Clear filters</Button>}
        </aside>
        )}

        <div ref={top} className="flex min-w-0 scroll-mt-24 flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Search
            <Input type="search" value={filters.text} maxLength={80} onChange={(e) => change({ ...filters, text: e.target.value })} placeholder="For example, SQL, Excel or Anthropic" />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-muted-foreground">
              {found.length} {found.length === 1 ? "result" : "results"}
              {on ? " for your filters" : ""}
              {pages > 1 ? ` · page ${page} of ${pages}` : ""}
            </p>
            <FiltersToggle open={showFilters} chosen={chosen} onToggle={() => setShowFilters(!showFilters)} />
          </div>
          {found.length ? (
            <ul aria-label="Courses and resources" className={showFilters ? GRID : GRID_WIDE}>
              {pageOf(found, page, PAGE).map((r) => <ResourceRow key={r.id} resource={r} plan={plan} />)}
            </ul>
          ) : (
            <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">Nothing matches these filters. Try fewer filters, or search Company courses.</p>
          )}
          <Pager page={page} pages={pages} onPage={go} label="Courses and resources" />
        </div>
      </div>
    </section>
  );
}
