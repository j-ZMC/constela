"use client";

import { useState, type FormEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { clearResumeProfile, loadResumeProfile, saveResumeProfile } from "@/lib/local-profile";
import { parseResumeProfile, type ResumeProfile } from "@/lib/resume";

// Optional: a PDF CV, read on the server (the file is deleted right after) and kept on this device.
// It powers "For you" on the Jobs page.
export function CvSection() {
  const [profile, setProfile] = useState<ResumeProfile | null>(() => loadResumeProfile());
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [fileName, setFileName] = useState("");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      setStatus("Choose a PDF file first.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const response = await fetch("/api/resume/parse", { method: "POST", body: form });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof body === "object" && body !== null && "error" in body && typeof body.error === "object" && body.error !== null && "message" in body.error
            ? String(body.error.message)
            : "We could not read this PDF.";
        throw new Error(message);
      }
      const parsed = parseResumeProfile(typeof body === "object" && body !== null && "profile" in body ? body.profile : null);
      if (!parsed) throw new Error("We could not read this PDF.");
      saveResumeProfile(parsed);
      setProfile(parsed);
      setStatus("We read your CV. Jobs for you are ready on the Jobs page.");
      formEl.reset();
      setFileName("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "We could not read this PDF.");
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    clearResumeProfile();
    setProfile(null);
    setStatus("Your CV is removed from this device.");
  }

  return (
    <section data-tour="profile-cv" id="cv" aria-labelledby="cv-heading" className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 id="cv-heading" className="text-xl font-semibold">
          Your CV
        </h2>
        <p className="text-muted-foreground">Optional. Add your CV as a PDF and we pick jobs that fit your skills.</p>
      </div>
      {profile ? (
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="font-medium">Skills we found</dt>
              <dd className="text-muted-foreground">{profile.skills_found.join(", ") || "None found"}</dd>
            </div>
            <div>
              <dt className="font-medium">Areas you worked in</dt>
              <dd className="text-muted-foreground">{profile.sectors.join(", ") || "None found"}</dd>
            </div>
          </dl>
          <Button type="button" variant="outline" size="touch" className="w-fit" onClick={clear}>
            Remove my CV
          </Button>
        </div>
      ) : (
        <form onSubmit={upload} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
          {/* Our own button instead of the browser's file picker, whose text follows the browser's language, not the app's. */}
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="cv-file"
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              className="peer sr-only"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            />
            <label
              htmlFor="cv-file"
              className={buttonVariants({ variant: "outline", size: "touch", className: "cursor-pointer peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50" })}
            >
              Choose a PDF
            </label>
            <span className="text-muted-foreground">{fileName || "No file chosen yet."}</span>
          </div>
          <Button type="submit" size="touch" className="w-fit" disabled={loading || !fileName}>
            {loading ? "Reading your CV…" : "Add my CV"}
          </Button>
        </form>
      )}
      <p role="status" className="text-sm text-muted-foreground">
        {status}
      </p>
    </section>
  );
}
