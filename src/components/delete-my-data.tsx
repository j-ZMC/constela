"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Everything Constela keeps lives in this browser under these keys (profile, plan, reading and personalization).
const KEYS = [
  "profile",
  "profile-step",
  "plan",
  "a11y",
  "pz",
  "pz-boot",
  "account-profile",
  "resume-profile",
  "job-barrier-preferences",
  "recommended-jobs-cache",
  "saved-jobs",
  "job-filters",
  "learn-filters",
  "tour",
  "help-picks",
];

// restart: after deleting, open the app fresh at the first form ("What is hard for you?" in the Profile). A full page
// load, not a client navigation: pages already visited stay mounted with what they knew about the person.
export function DeleteMyData({ restart = false }: { restart?: boolean }) {
  const [step, setStep] = useState<"idle" | "confirm" | "done">("idle");
  const [error, setError] = useState(false);
  if (step === "done") return <p role="status">Your data is deleted from this device.</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {step === "idle" ? (
        <Button variant="outline" className="h-11 px-5 text-base" onClick={() => setStep("confirm")}>
          Delete my data
        </Button>
      ) : (
        <>
          <p className="w-full">This deletes your profile, CV data, plan, saved jobs and settings on this device. It cannot be undone.</p>
          <Button
            variant="destructive"
            className="h-11 px-5 text-base"
            onClick={() => {
              try {
                KEYS.forEach((k) => localStorage.removeItem(k));
                const html = document.documentElement;
                html.removeAttribute("style");
                ["data-pz", "data-pz-icons", "data-pz-detail", "data-pz-scheme", "data-pz-calm"].forEach((a) => html.removeAttribute(a));
                html.classList.remove("dyslexic", "text-large", "calm", "reduce-motion", "focus-strong");
                // A full load on purpose: router.push keeps visited pages mounted with the old data (cacheComponents).
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                if (restart) return window.location.assign("/profile");
                setStep("done");
              } catch {
                setError(true);
              }
            }}
          >
            {restart ? "Yes, delete everything and start over" : "Yes, delete everything"}
          </Button>
          <Button variant="ghost" className="h-11 px-5 text-base" onClick={() => { setError(false); setStep("idle"); }}>
            Keep my data
          </Button>
          {error && <p role="alert" className="w-full text-sm text-destructive">Could not delete the data. Check your browser storage permissions and try again.</p>}
        </>
      )}
    </div>
  );
}
