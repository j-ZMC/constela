"use client";

import { useState } from "react";
import { AccountSection } from "@/components/profile/account-section";
import { BarrierSurvey } from "@/components/profile/barrier-survey";
import { CvSection } from "@/components/profile/cv-section";
import { ProfileFlow } from "@/components/profile/profile-flow";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

type Section = "account" | "questionnaire" | "cv";
const sections: Array<{ id: Section; label: string }> = [
  { id: "account", label: "Account" },
  { id: "questionnaire", label: "Questionnaire" },
  { id: "cv", label: "CV" },
];

export function ProfileHub() {
  const hydrated = useHydrated();
  const [section, setSection] = useState<Section>("account");

  if (!hydrated) return null;

  return (
    <section aria-labelledby="profile-heading" className="flex flex-col gap-6">
      <div>
        <h1 id="profile-heading" className="text-3xl font-bold">Your profile</h1>
        <p className="mt-2 text-muted-foreground">Manage your local account details, questionnaire answers, and CV.</p>
      </div>
      <div role="tablist" aria-label="Profile sections" className="grid grid-cols-3 rounded-lg border bg-card p-1">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={section === item.id}
            className={cn("min-h-11 rounded-md px-3 text-sm font-medium", section === item.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={sections.find((item) => item.id === section)?.label}>
        {section === "account" && <AccountSection />}
        {section === "questionnaire" && (
          <div className="flex flex-col gap-12">
            <ProfileFlow />
            <BarrierSurvey />
          </div>
        )}
        {section === "cv" && <CvSection />}
      </div>
    </section>
  );
}
