import { PublishedVacancies } from "@/components/employers/published-vacancies";
import { JobsView } from "@/components/jobs/jobs-view";
import { PageSky, onSky } from "@/components/page-sky";
import { HowItWorks, type TourStep } from "@/components/tour";

const JOBS_TOUR: TourStep[] = [
  { target: "jobs-tabs", title: "Two ways to find jobs", text: "For you shows jobs picked from your CV. Search lets you look for any job in your own words." },
  { target: "jobs-clear", title: "Jobs written clearly", text: "These employers say what the work is, what it pays and every step of hiring." },
  {
    target: "jobs-search",
    title: "Search in your words",
    text: "Type a job title or a skill. We point out what you asked us to watch for, but we never hide a job. Save one you like and it goes to My plan.",
  },
];

export default function JobsPage() {
  return (
    <main className="flex flex-col">
      <PageSky width="max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <h1 className="text-3xl font-bold text-balance sm:text-4xl">Jobs</h1>
          <HowItWorks name="jobs" steps={JOBS_TOUR} className={onSky} />
        </div>
        <p className="text-pretty text-white/80">Jobs picked for you, or search for any job. We point out what you asked us to watch for.</p>
      </PageSky>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
        <JobsView />
        {/* After the search: the person came to find jobs, so the tabs sit right under the sky. */}
        <PublishedVacancies />
      </div>
    </main>
  );
}
