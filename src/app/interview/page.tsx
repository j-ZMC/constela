import { Suspense } from "react";
import { InterviewChat } from "@/components/interview/interview-chat";
import { PageSky } from "@/components/page-sky";

export default function InterviewPage() {
  return (
    <main className="flex flex-col">
      <PageSky>
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Get ready for your interview</h1>
        <p className="text-pretty text-white/80">
          Practice with an AI interviewer, learn how to answer, or understand a message. Write or talk, whatever is easier for you.
        </p>
      </PageSky>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
        {/* InterviewChat reads ?saved= from the URL, so it renders in the browser only. */}
        <Suspense><InterviewChat /></Suspense>
      </div>
    </main>
  );
}
