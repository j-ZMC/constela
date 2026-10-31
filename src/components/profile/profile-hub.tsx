"use client";

import { AccountSection } from "@/components/profile/account-section";
import { BarrierSurvey } from "@/components/profile/barrier-survey";
import { CvSection } from "@/components/profile/cv-section";
import { ProfileFlow } from "@/components/profile/profile-flow";

// One page, one path: the questions first (they shape the whole app), then the optional parts.
// No tabs: a first visit lands on "Let's get to know you", not on a form.
export function ProfileHub() {
  return (
    <ProfileFlow
      after={
        <div className="flex flex-col gap-10 border-t pt-8">
          <BarrierSurvey />
          <CvSection />
          <AccountSection />
        </div>
      }
    />
  );
}
