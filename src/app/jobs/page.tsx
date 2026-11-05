import { Suspense } from "react";
import { PublishedVacancies } from "@/components/employers/published-vacancies";
import { JobsHub } from "@/components/jobs/jobs-hub";
import { PageSky } from "@/components/page-sky";
import { FirstVisitTour, type TourStep } from "@/components/tour";

const JOBS_TOUR: TourStep[] = [
  { target: "job-search", title: "Search for a job", text: "Write the job you want in your own words, like \"remote data analyst\". The search understands what you mean, not only the exact words." },
  { target: "for-you", title: "Jobs for you", text: "With your CV in the Profile, Constela picks jobs that fit your skills and experience. Add a CV anytime and this list fills in." },
  { target: "job-tabs", title: "Internships and saved jobs", text: "Internships have their own tab. Save the jobs you like, and Saved keeps them with what you found out and whether you applied." },
  { target: "job-tabs", title: "What the flags mean", text: "A flag marks a job that mentions something you asked us to watch for in Job conditions, like noise or time pressure. It asks you to look closer. It never hides a job: you decide. Each job also shows what we know about how inclusive the company is." },
];

export default function JobsPage() {
  return (
    <main className="flex flex-col">
      <PageSky width="max-w-5xl">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Jobs</h1>
        <p className="text-pretty text-white/80">Jobs picked for you, internships, and the jobs you saved. We point out what you asked us to watch for.</p>
      </PageSky>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-8">
        {/* JobsHub reads ?tab= from the URL, so it renders in the browser only. */}
        <Suspense><JobsHub /></Suspense>
        <FirstVisitTour name="jobs" steps={JOBS_TOUR} next={{ label: "Next: Preparation", href: "/interview", tour: "preparation" }} />
        {/* Job posts from Constela for Employers. Nothing shows until an employer publishes one. */}
        <PublishedVacancies />
      </div>
    </main>
  );
}
