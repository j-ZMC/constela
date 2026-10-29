import { JobSearch } from "@/components/jobs/job-search";

export default function JobsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Jobs for you</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">
        Search current openings from the job database. Your profile conditions flag possible matches for review; they never automatically rule out a job.
      </p>
      <JobSearch />
    </main>
  );
}
