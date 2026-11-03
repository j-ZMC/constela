import { Ban, HardDrive, Send, Trash2 } from "lucide-react";
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
        <p className="text-pretty text-white/80">Draft for the Constela prototype. Last updated 4 November 2026.</p>
      </PageSky>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-8">

      <Summarized summary="Your saved profile stays in this browser. Searches and optional features send only the data described below. Job posts an employer publishes are public. You can delete saved data below.">
      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><HardDrive aria-hidden className="size-6 shrink-0 text-primary" />What we keep, and where</h2>
        <p>Your answers, contact details, parsed CV profile, plan and settings are saved in this browser, on this device. We do not have online accounts or keep your profile data on a server.</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>Your profile answers, which describe needs, never diagnoses</li>
          <li>What you chose in &quot;What is hard for you?&quot;</li>
          <li>Your plan: steps, stars and stages</li>
          <li>Whether you asked for easier steps today</li>
          <li>Your reading and personalization settings</li>
          <li>Your parsed CV profile, if you upload a CV</li>
          <li>The jobs you save, whether you said you applied, and what Wikipedia says about their companies</li>
          <li>Your job and course filters</li>
          <li>Invitations from employers, and your answers</li>
          <li>If you use Constela for Employers: your job posts and interview questions</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><Send aria-hidden className="size-6 shrink-0 text-primary" />What leaves your device</h2>
        <p>
          When you upload a CV, its PDF is sent to the app to extract text. The app does not save the PDF or send it to an AI service.
          It returns the parsed profile to this browser.
        </p>
        <p>
          When you search for jobs, your search phrase, selected work conditions and your own words are sent to Constela. An AI
          model on that same computer (Ollama) turns the phrase into numbers to find matches. Nothing is sent to another
          company.
        </p>
        <p>
          When you have a CV saved, &quot;Jobs for you&quot; in Jobs builds its own search from your skills, sectors, experience, projects
          and preferred work arrangement. That text is sent to Constela and stays on that computer. Your name and email are not
          added to it.
        </p>
        <p>
          When you practice an interview or work on your CV, your choices, your job title and your answers (and any part of your
          CV you paste) are sent to an AI model (Ollama) that
          runs on the same computer as Constela. If you keep &quot;Use my CV and plan&quot; on, the skills, sectors, experience
          and projects from your CV and the steps of your plan go with them, never your name or contact details. If you
          pick a saved job, the start of its posting and what Wikipedia says about the company go too. Constela does
          not save the chat. It ends when you leave the page.
        </p>
        <p>
          When you press &quot;Look up&quot; on a saved job, Constela opens the job&apos;s page, and the AI on that same computer lists
          the experience it asks for. To learn about the company, Constela asks Wikipedia for the company name only, and the
          AI on this computer sums up what Wikipedia says. Nothing about you is sent. The answer is saved with the job in this browser.
        </p>
        <p>
          When you choose Talk, your browser records your voice and sends it to Constela on that same computer. Whisper turns it
          into text there, and the recording is deleted right after. When the AI talks, its voice is made by Kokoro on that same
          computer too; if Kokoro is not ready, your browser&apos;s voice reads instead.
        </p>
        <p>
          If you practice a video call with your camera, your picture only shows on this screen. It is not recorded, saved
          or sent anywhere. Constela only checks how much light the picture has, to give you a tip. Turning the camera off or
          leaving the page closes it.
        </p>
        <p>
          Before a video call, Constela looks for your face in the picture to say if it is in the middle. This runs in your
          browser with MediaPipe. The first time, your browser downloads that tool from a public website (jsDelivr), so that
          site sees your internet address. Your picture never leaves this device.
        </p>
        <p>
          &quot;For a real meeting&quot; can show live captions. You choose a tab to share, and Whisper on this computer writes
          down what the meeting says. Nothing is saved, and the captions are gone when you stop. Ask the people in the meeting
          if that is okay with them.
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
          is sent to pick them. &quot;Search company courses&quot; looks in Constela&apos;s own list of courses from those
          companies&apos; official sites, on this device; nothing is sent. Course sites have their own privacy rules.
        </p>
        <p>
          When you press &quot;Break it down for me&quot;, we send the task text to Groq to get smaller steps. We also send three
          settings that shape the answer and which starter step it is. Constela does not save the task text; each AI service
          handles its data under its own privacy policy.
        </p>
        <p>
          If you use Constela for Employers: when you press &quot;Read it for me&quot;, &quot;Write it for me&quot; or &quot;Draft
          with AI&quot;, we send that job post text to Groq. No candidate&apos;s details go with it.
        </p>
        <p>
          When an employer publishes a job post, a copy goes to our server, and anyone can read it there. Tools like a browser
          extension use it to show the job post and the seal. The dates of the employer&apos;s answers go too, to work out the seal,
          but never who the answers were for. Unpublishing a job post removes it, and so does deleting your data below.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><Ban aria-hidden className="size-6 shrink-0 text-primary" />What we do not do</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>We do not guess your feelings or your condition from what you write.</li>
          <li>If you use &quot;Shortcuts by type&quot;, we keep only the screen settings it turns on, never which type you chose.</li>
          <li>
            If you turn on &quot;Adjust the practice to how it is going&quot;, Constela looks at your answers and, on this computer
            only, at your pauses and pace when you speak and at your face (with the camera on). It only makes the next question easier. It never
            shows, saves or sends what it read.
          </li>
          <li>We do not use ads or tracking.</li>
          <li>We do not sell your data.</li>
          <li>We do not show employers your name unless you say yes to an invitation.</li>
        </ul>
      </section>
      </Summarized>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><Trash2 aria-hidden className="size-6 shrink-0 text-primary" />Delete your data</h2>
        <p>You can delete everything Constela saved in this browser, including your CV profile, at any time.</p>
        <DeleteMyData />
      </section>
      </div>
    </main>
  );
}
