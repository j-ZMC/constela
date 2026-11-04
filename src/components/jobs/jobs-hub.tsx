"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { JobSearch } from "@/components/jobs/job-search";
import { SavedJobs } from "@/components/jobs/saved-jobs";
import { RecommendedJobs } from "@/components/recommended-jobs";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { useSavedJobs } from "@/lib/saved-jobs";
import { useHydrated } from "@/lib/use-hydrated";
import { Loading } from "@/components/loading";

const TABS = ["jobs", "internships", "saved"] as const;

// The CV lives in localStorage, so render only after hydration.
export function JobsHub() {
  return useHydrated() ? <Hub /> : <Loading />;
}

type Tab = (typeof TABS)[number];
// For you and Search used to be two tabs; old links to them open Jobs, where both now live.
const asTab = (value: unknown) => (value === "for-you" || value === "search" ? "jobs" : TABS.find((tab) => tab === value));

function Hub() {
  // My plan links straight to a tab, e.g. /jobs?tab=saved. The page stays mounted between visits,
  // so a new ?tab= has to switch the open tab too, not only the first one.
  const asked = asTab(useSearchParams().get("tab"));
  const [tab, setTab] = useState<Tab>(() => asked ?? "jobs");
  const [lastAsked, setLastAsked] = useState(asked);
  // Internships load the first time their tab opens, not with the page.
  const [internshipsOpened, setInternshipsOpened] = useState(tab === "internships");
  if (asked !== lastAsked) {
    setLastAsked(asked);
    if (asked) setTab(asked);
    if (asked === "internships") setInternshipsOpened(true);
  }
  const savedCount = useSavedJobs().length;
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const next = asTab(value);
        if (!next) return;
        setTab(next);
        if (next === "internships") setInternshipsOpened(true);
      }}
    >
      <TabsList aria-label="Ways to find jobs" className="max-w-md">
        <TabsTrigger value="jobs">Jobs</TabsTrigger>
        <TabsTrigger value="internships">Internships</TabsTrigger>
        <TabsTrigger value="saved">Saved{savedCount ? ` (${savedCount})` : ""}</TabsTrigger>
      </TabsList>
      {/* keepMounted: changing tabs must not throw away a search or its results. */}
      <TabsPanel value="jobs" keepMounted><JobSearch home={<RecommendedJobs />} /></TabsPanel>
      <TabsPanel value="internships" keepMounted>{internshipsOpened && <JobSearch internships />}</TabsPanel>
      <TabsPanel value="saved" keepMounted><SavedJobs /></TabsPanel>
    </Tabs>
  );
}
