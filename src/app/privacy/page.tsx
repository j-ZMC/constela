import type { Metadata } from "next";
import { DeleteMyData } from "@/components/delete-my-data";
import { PageSky } from "@/components/page-sky";
import { Summarized } from "@/components/summary";

export const metadata: Metadata = { title: "Privacy · Constela" };

// Draft for the prototype, in Easy Read. Update it before accounts (Supabase) or analytics are added.
export default function PrivacyPage() {
  return (
    <main className="flex flex-col">
      <PageSky>
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Your privacy</h1>
        <p className="text-pretty text-white/80">Draft for the Constela prototype. Last updated 3 November 2026.</p>
      </PageSky>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-8">

      <Summarized summary="Your saved profile stays in this browser. Searches and optional features send only the data described below. You can delete saved data below.">
      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">What we keep, and where</h2>
        <p>Your answers, contact details, parsed CV profile, plan and settings are saved in this browser, on this device. We do not have online accounts or keep your profile data on a server.</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Your profile answers, which describe needs, never diagnoses</li>
          <li>Your plan: steps, stars and stages</li>
          <li>Whether you asked for easier steps today</li>
          <li>Your reading and personalization settings</li>
          <li>Your parsed CV profile, if you upload a CV</li>
          <li>The jobs you save, whether you said you applied, and what a web search found about their companies</li>
          <li>Your job and course filters</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">What leaves your device</h2>
        <p>
          When you upload a CV, its PDF is sent to the app to extract text. The app does not save the PDF or send it to an AI service.
          It returns the parsed profile to this browser.
        </p>
        <p>
          When you search for jobs, your search phrase, selected work conditions and your own words are sent to Constela. The
          phrase is sent to OpenAI to find matches; work conditions and your own words are used by Constela and are not sent to
          OpenAI.
        </p>
        <p>
          When you have a CV saved, &quot;Jobs for you&quot; in Jobs builds its own search from your skills, sectors, experience, projects
          and preferred work arrangement. That text is sent to Constela and OpenAI to find matches. Your name and email are not
          added to it.
        </p>
        <p>
          When you practice an interview, your choices, your job title and your answers are sent to an AI model (Ollama) that
          runs on the same computer as Constela. If you keep &quot;Use my CV and plan&quot; on, the skills, sectors, experience
          and projects from your CV and the steps of your plan go with them, never your name or contact details. If you
          pick a saved job, the start of its posting and what the web search found about the company go too. Constela does
          not save the chat. It ends when you leave the page.
        </p>
        <p>
          When you press &quot;Look up&quot; on a saved job, Constela opens the job&apos;s page and sends its text, the company
          name, the job title and its place to OpenAI, which lists the experience it asks for and searches the web about the
          company. Nothing about you is sent. The answer is saved with the job in this browser.
        </p>
        <p>
          When you choose Talk, your browser records your voice and sends it to Constela on that same computer. Whisper turns it
          into text there, and the recording is deleted right after. When the AI talks, its voice is made by Kokoro on that same
          computer too; if Kokoro is not ready, your browser&apos;s voice reads instead.
        </p>
        <p>
          &quot;Hey Constela&quot; in My plan works the same way: your question, the steps of your plan and the skills and
          experience from your CV go to the AI on that same computer, and the chat is not saved. If you turn on
          &quot;Listen for Hey Constela&quot;, the microphone stays on while My plan is open. Each thing you say is written down
          by Whisper on that computer to look for the words &quot;Hey Constela&quot;, then deleted. Leaving My plan or turning
          it off closes the microphone.
        </p>
        <p>
          Learn picks courses on this device, from the skills your saved jobs ask for and the skills in your CV. Nothing
          is sent to pick them. When you press &quot;Search company courses&quot;, only your search words and the company
          you chose go to OpenAI, which looks only at those companies&apos; official course sites. Course sites have their
          own privacy rules.
        </p>
        <p>
          When you press &quot;Break it down for me&quot;, we send the task text to Groq to get smaller steps. We also send three
          settings that shape the answer and which starter step it is. Constela does not save the task text; each AI service
          handles its data under its own privacy policy.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">What we do not do</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>We do not guess your feelings or your condition from what you write.</li>
          <li>We do not use ads or tracking.</li>
          <li>We do not sell your data.</li>
        </ul>
      </section>
      </Summarized>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Delete your data</h2>
        <p>You can delete everything Constela saved in this browser, including your CV profile, at any time.</p>
        <DeleteMyData />
      </section>
      </div>
    </main>
  );
}
