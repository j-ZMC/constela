import { Suspense } from "react";
import { InterviewChat } from "@/components/interview/interview-chat";
import { PageSky } from "@/components/page-sky";

export default function InterviewPage() {
  return (
    <main className="flex flex-col">
      <PageSky width="max-w-4xl">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Get ready to apply</h1>
        <p className="text-pretty text-white/80">
          Work on your CV, practice with an AI interviewer, or understand a message. Write or talk, whatever is easier for you.
        </p>
      </PageSky>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
        {/* InterviewChat reads ?saved= from the URL, so it renders in the browser only. */}
        <Suspense><InterviewChat /></Suspense>
      </div>
    </main>
  );
}
