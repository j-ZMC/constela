import { JobsView } from "@/components/jobs/jobs-view";

export default function JobsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold sm:text-3xl">Jobs</h1>
        <p className="text-muted-foreground">Jobs picked for you, or search for any job. We point out what you asked us to watch for.</p>
      </div>
      <JobsView />
    </main>
  );
}
