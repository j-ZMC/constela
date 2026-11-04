import { Suspense } from "react";
import { LearnView } from "@/components/learn/learn-view";
import { PageSky } from "@/components/page-sky";

export default function LearnPage() {
  return (
    <main className="flex flex-col">
      <PageSky width="max-w-5xl">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Learn</h1>
        <p className="text-pretty text-white/80">Courses, certificates and guides for the work you want, many of them free.</p>
      </PageSky>
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        {/* LearnView reads ?job= from the URL, so it renders in the browser only. */}
        <Suspense><LearnView /></Suspense>
      </div>
    </main>
  );
}
