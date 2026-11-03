"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { clearResumeProfile, loadResumeProfile, saveResumeProfile } from "@/lib/local-profile";
import { parseResumeProfile, type ResumeProfile } from "@/lib/resume";
import { useSingleFlight } from "@/lib/use-single-flight";

// A message written for people, safe to show as it is.
class ReadError extends Error {}

const action = "h-11 px-5 text-base";

export function CvSection() {
  const [profile, setProfile] = useState<ResumeProfile | null>(() => loadResumeProfile());
  const [loading, setLoading] = useState(false);
  const once = useSingleFlight();
  const [status, setStatus] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // React clears currentTarget after the first await. One upload at a time, even on a double tap.
    const formElement = event.currentTarget;
    void once(() => upload(formElement));
  }

  async function upload(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      setStatus("Choose a PDF resume first.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/resume/parse", { method: "POST", body: form });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "message" in body.error
          ? String(body.error.message)
          : "Could not read this PDF right now. Try again.";
        throw new ReadError(message);
      }
      const parsed = parseResumeProfile(typeof body === "object" && body !== null && "profile" in body ? body.profile : null);
      if (!parsed) throw new ReadError("Could not read this PDF. Use a text-based PDF.");
      saveResumeProfile(parsed);
      setProfile(parsed);
      setStatus("CV read and saved on this device.");
      formElement.reset();
    } catch (error) {
      // Only our own words reach the screen; a browser error ("Failed to fetch") gets a plain one.
      setStatus(error instanceof ReadError ? error.message : "Could not reach Constela. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    clearResumeProfile();
    setProfile(null);
    setStatus("Saved CV data cleared.");
  }

  return (
    <section aria-labelledby="cv-heading" className="flex flex-col gap-5">
      <div>
        <h2 id="cv-heading" className="text-2xl font-semibold">Add your CV</h2>
        <p className="mt-2 text-muted-foreground">
          We use it to pick jobs for you. Upload a PDF with real text, not a scan. We read it and do not save the file.
          What we find stays in this browser.
        </p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <label className="flex flex-col gap-2 text-sm font-medium">
          PDF resume
          <input name="file" type="file" accept="application/pdf,.pdf" className="block w-full rounded-md border border-input bg-background p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-2" />
        </label>
        <Button type="submit" variant={profile ? "outline" : "default"} disabled={loading} className={`${action} w-fit`}>
          {loading ? "Reading CV…" : profile ? "Replace CV" : "Add CV"}
        </Button>
      </form>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">{status}</p>
      {profile && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">What we found</h3>
            <Button type="button" variant="ghost" className={action} onClick={clear}>Clear CV</Button>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="font-medium">Name</dt><dd>{profile.name}</dd></div>
            <div><dt className="font-medium">Email</dt><dd>{profile.email}</dd></div>
            <div><dt className="font-medium">Skills</dt><dd>{profile.skills_found.join(", ") || "None found"}</dd></div>
            <div><dt className="font-medium">Sectors</dt><dd>{profile.sectors.join(", ") || "None found"}</dd></div>
          </dl>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {profile && <Link href="/jobs" className={buttonVariants({ className: action })}>See jobs for you</Link>}
        <Link href="/plan" className={buttonVariants({ variant: "outline", className: action })}>
          {profile ? "Go to my plan" : "Skip for now"}
        </Link>
      </div>
    </section>
  );
}
