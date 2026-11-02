"use client";

import { useState } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { JobSearch } from "@/components/jobs/job-search";
import { RecommendedJobs } from "@/components/recommended-jobs";
import { loadResumeProfile } from "@/lib/local-profile";
import { useHydrated } from "@/lib/use-hydrated";

export function JobsView() {
  return useHydrated() ? (
    <View />
  ) : (
    <p role="status" className="text-muted-foreground">
      Loading jobs…
    </p>
  );
}

const tab =
  "flex h-11 flex-1 items-center justify-center rounded-lg px-4 text-base font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring data-[active]:bg-primary data-[active]:text-primary-foreground";

// One Jobs page, two ways in: picked from your CV, or your own search. Opens on "For you" once a CV is added.
function View() {
  const [value, setValue] = useState<string>(() => (loadResumeProfile() ? "for-you" : "search"));
  return (
    <Tabs.Root value={value} onValueChange={(v) => setValue(String(v))} className="flex flex-col gap-6">
      <Tabs.List data-tour="jobs-tabs" aria-label="How to find jobs" className="flex gap-1 rounded-xl border bg-card p-1">
        <Tabs.Tab value="for-you" className={tab}>
          For you
        </Tabs.Tab>
        <Tabs.Tab value="search" className={tab}>
          Search
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="for-you">
        <RecommendedJobs onSearch={() => setValue("search")} />
      </Tabs.Panel>
      <Tabs.Panel value="search">
        <JobSearch />
      </Tabs.Panel>
    </Tabs.Root>
  );
}
