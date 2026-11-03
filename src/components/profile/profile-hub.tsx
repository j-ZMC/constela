"use client";

import { AccountSection } from "@/components/profile/account-section";
import { BarrierSurvey } from "@/components/profile/barrier-survey";
import { CvSection } from "@/components/profile/cv-section";
import { ProfileFlow } from "@/components/profile/profile-flow";
import { ProfileMore } from "@/components/profile/profile-more";
import { HowItWorks, type TourStep } from "@/components/tour";

const PROFILE_TOUR: TourStep[] = [
  { target: "profile-questions", title: "A few short questions", text: "They fit the whole app to how you work. Skip any question, and change your answers anytime." },
  {
    target: "profile-more",
    title: "Add more, if you want",
    text: "Pick things at work you want us to point out, like noise. Add your CV to see jobs picked for you. All optional.",
  },
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
        <ProfileMore>
          <BarrierSurvey />
          <CvSection />
          <AccountSection />
        </ProfileMore>
      }
    />
    </>
  );
}
