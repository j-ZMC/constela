import { RecommendedJobs } from "@/components/recommended-jobs";

export default function RecommendedPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">Recommended jobs</h1>
      <p className="mt-2 max-w-3xl text-muted-foreground">A shortlist based on your CV, questionnaire, and saved workplace preferences.</p>
      <div className="mt-8"><RecommendedJobs /></div>
    </main>
  );
}
