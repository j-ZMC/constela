"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { clearResumeProfile, loadResumeProfile, saveResumeProfile } from "@/lib/local-profile";
import { parseResumeProfile, type ResumeProfile } from "@/lib/resume";

export function CvSection() {
  const [profile, setProfile] = useState<ResumeProfile | null>(() => loadResumeProfile());
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
          : "Could not read this PDF.";
        throw new Error(message);
      }
      const parsed = parseResumeProfile(typeof body === "object" && body !== null && "profile" in body ? body.profile : null);
      if (!parsed) throw new Error("The parser returned an invalid profile.");
      saveResumeProfile(parsed);
      setProfile(parsed);
      setStatus("CV read and saved on this device.");
      event.currentTarget.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not read this PDF.");
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
    <section aria-labelledby="cv-heading" className="flex max-w-3xl flex-col gap-5">
      <div>
        <h2 id="cv-heading" className="text-2xl font-semibold">CV</h2>
        <p className="mt-2 text-muted-foreground">Upload a text-based PDF. The parsed JSON stays on this device.</p>
      </div>
      <form onSubmit={upload} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <label className="flex flex-col gap-2 text-sm font-medium">
          PDF resume
          <input name="file" type="file" accept="application/pdf,.pdf" className="block w-full rounded-md border border-input bg-background p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-2" />
        </label>
        <Button type="submit" disabled={loading} className="h-11 w-fit px-5">{loading ? "Reading CV…" : "Add CV"}</Button>
      </form>
      {profile && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Parsed CV data</h3>
              <p className="mt-1 text-sm text-muted-foreground">Used for recommendations without sending your contact details.</p>
            </div>
            <Button type="button" variant="outline" onClick={clear}>Clear CV</Button>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="font-medium">Name</dt><dd>{profile.name}</dd></div>
            <div><dt className="font-medium">Email</dt><dd>{profile.email}</dd></div>
            <div><dt className="font-medium">Skills</dt><dd>{profile.skills_found.join(", ") || "None found"}</dd></div>
            <div><dt className="font-medium">Sectors</dt><dd>{profile.sectors.join(", ") || "None found"}</dd></div>
          </dl>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium underline underline-offset-4">View JSON</summary>
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg bg-secondary p-3 text-xs">{JSON.stringify(profile, null, 2)}</pre>
          </details>
        </div>
      )}
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">{status}</p>
    </section>
  );
}
