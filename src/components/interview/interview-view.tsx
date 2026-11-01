"use client";

import { Tabs } from "@base-ui/react/tabs";
import { Practice } from "@/components/interview/practice";
import { WhatToExpect } from "@/components/interview/what-to-expect";
import { useHydrated } from "@/lib/use-hydrated";

const tab =
  "flex h-11 flex-1 items-center justify-center rounded-lg px-4 text-base font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring data-[active]:bg-primary data-[active]:text-primary-foreground";

// The two interview steps of My plan, one tab each: practice a question, or read what the day is like.
export function InterviewView() {
  if (!useHydrated())
    return (
      <p role="status" className="text-muted-foreground">
        Loading…
      </p>
    );
  return (
    <Tabs.Root defaultValue="practice" className="flex flex-col gap-6">
      <Tabs.List aria-label="Interview" className="flex gap-1 rounded-xl border bg-card p-1">
        <Tabs.Tab value="practice" className={tab}>
          Practice
        </Tabs.Tab>
        <Tabs.Tab value="expect" className={tab}>
          What to expect
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="practice">
        <Practice />
      </Tabs.Panel>
      <Tabs.Panel value="expect">
        <WhatToExpect />
      </Tabs.Panel>
    </Tabs.Root>
  );
}
