import { PublishedVacancies } from "@/components/employers/published-vacancies";
import { JobsView } from "@/components/jobs/jobs-view";
import { PageSky } from "@/components/page-sky";

export default function JobsPage() {
  return (
    <main className="flex flex-col">
      <PageSky width="max-w-3xl">
        <h1 className="text-3xl font-bold text-balance sm:text-4xl">Jobs</h1>
        <p className="text-pretty text-white/80">Jobs picked for you, or search for any job. We point out what you asked us to watch for.</p>
      </PageSky>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8">
        <PublishedVacancies />
        <JobsView />
      </div>
    </main>
  );
}
