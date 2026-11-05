"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { AccountSection } from "@/components/profile/account-section";
import { BarrierSurvey } from "@/components/profile/barrier-survey";
import { CvSection } from "@/components/profile/cv-section";
import { ProfileFlow } from "@/components/profile/profile-flow";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { loadBarrierPreferences } from "@/lib/barrier-preferences";
import { loadResumeProfile } from "@/lib/local-profile";
import { loadHelpPicks, useHelpPicksSnapshot } from "@/lib/help-picks";
import { useHydrated } from "@/lib/use-hydrated";
import { Loading } from "@/components/loading";

type Section = "needs" | "conditions" | "cv" | "contact";
const sections: Array<{ id: Section; label: string }> = [
  { id: "needs", label: "Adaptability" },
  { id: "conditions", label: "Job conditions" },
  { id: "cv", label: "CV" },
  { id: "contact", label: "Contact details" },
];

// Contact details are optional and nothing depends on them, so they never count as unfinished.
const progress = (): Partial<Record<Section, boolean>> => ({
  needs: loadHelpPicks() !== null,
  conditions: loadBarrierPreferences() !== null,
  cv: loadResumeProfile() !== null,
});

// Saved progress lives in localStorage, so render only after hydration.
export function ProfileHub() {
  return useHydrated() ? <Hub /> : <Loading />;
}

function Hub() {
  useHelpPicksSnapshot(); // the "done" tick on Adaptability, when the first-start window saves the picks
  // Open where the person left off, so "Get started" and "Finish your profile" land on the next real task.
  const [section, setSection] = useState<Section>(() => {
    const done = progress();
    return sections.find(({ id }) => done[id] === false)?.id ?? "needs";
  });
  const done = progress();

  return (
    <section aria-labelledby="profile-heading" className="flex flex-col gap-6">
      <Tabs value={section} onValueChange={(value) => setSection(value as Section)}>
        <TabsList aria-label="Profile sections" className="grid grid-cols-2 sm:grid-cols-4">
          {sections.map(({ id, label }) => (
            <TabsTrigger key={id} value={id}>
              {done[id] && <Check aria-hidden className="size-4" />}
              {label}
              {done[id] && <span className="sr-only">, done</span>}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsPanel value="needs"><ProfileFlow onNext={() => setSection("conditions")} /></TabsPanel>
        <TabsPanel value="conditions"><BarrierSurvey onNext={() => setSection("cv")} /></TabsPanel>
        <TabsPanel value="cv"><CvSection onNext={() => setSection("contact")} /></TabsPanel>
        <TabsPanel value="contact"><AccountSection /></TabsPanel>
      </Tabs>
    </section>
  );
}
