import type { Metadata } from "next";
import { DeleteMyData } from "@/components/delete-my-data";
import { Summarized } from "@/components/summary";

export const metadata: Metadata = { title: "Privacy · Constela" };

// Draft for the prototype, in Easy Read. Update it before accounts (Supabase) or analytics are added.
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Your privacy</h1>
        <p className="text-muted-foreground">Draft for the Constela prototype. Last updated 29 October 2026.</p>
      </header>

      <Summarized summary="Your data stays on this device. Only a task you choose to break down reaches the AI. You can delete everything below.">
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">What we keep, and where</h2>
        <p>Your answers, your plan and your settings stay in this browser, on this device. We do not have accounts, and we do not keep your data on a server.</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Your profile answers, which describe needs, never diagnoses</li>
          <li>Your plan: steps, stars and stages</li>
          <li>How you said you feel today, if you used the check-in</li>
          <li>Your reading and personalization settings</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">What leaves your device</h2>
        <p>
          Only when you press &quot;Break it down for me&quot;, we send the text of that task to an AI service (Groq) to get smaller
          steps. We also send three settings that shape the answer, like &quot;keep steps short&quot;, and which starter step it is.
        </p>
        <p>
          We never send your profile answers, how you feel, or your name. Constela does not save the task text; Groq handles it
          under its own privacy policy.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">What we do not do</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>We do not guess your feelings or your condition from what you write.</li>
          <li>We do not use ads or tracking.</li>
          <li>We do not sell or share your data.</li>
        </ul>
      </section>
      </Summarized>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Delete your data</h2>
        <p>You can delete everything Constela saved on this device at any time.</p>
        <DeleteMyData />
      </section>
    </main>
  );
}
