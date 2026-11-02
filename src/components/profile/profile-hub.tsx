"use client";

import { AccountSection } from "@/components/profile/account-section";
import { BarrierSurvey } from "@/components/profile/barrier-survey";
import { CvSection } from "@/components/profile/cv-section";
import { ProfileFlow } from "@/components/profile/profile-flow";
import { HowItWorks, type TourStep } from "@/components/tour";

const PROFILE_TOUR: TourStep[] = [
  { target: "profile-questions", title: "A few short questions", text: "They fit the whole app to how you work. Skip any question, and change your answers anytime." },
  { target: "profile-work", title: "Things to point out at work", text: "Pick situations you want us to watch for, like noise or sudden changes. Jobs will point them out." },
  { target: "profile-cv", title: "Your CV, if you want", text: "Add it to see jobs picked for you. We read your skills, never your name or email." },
  { target: "profile-details", title: "Your details", text: "Optional, and they stay on this device. You do not need an account." },
];

// One page, one path: the questions first (they shape the whole app), then the optional parts.
// No tabs: a first visit lands on "Let's get to know you", not on a form.
export function ProfileHub() {
  // No tour on the first visit here: this page asks for one decision first, Start or Skip.
  return (
    <>
    <HowItWorks name="profile" steps={PROFILE_TOUR} firstVisit={false} className="-mb-6 self-end text-muted-foreground" />
    <ProfileFlow
      after={
        <div className="flex flex-col gap-10 border-t pt-8">
          <BarrierSurvey />
          <CvSection />
          <AccountSection />
        </div>
      }
    />
    </>
  );
}
