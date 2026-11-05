import { Suspense } from "react";
import { PublishedVacancies } from "@/components/employers/published-vacancies";
import { JobsHub } from "@/components/jobs/jobs-hub";
import { PageSky } from "@/components/page-sky";

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
        {/* Job posts from Constela for Employers. Nothing shows until an employer publishes one. */}
        <PublishedVacancies />
      </div>
    </main>
  );
}
