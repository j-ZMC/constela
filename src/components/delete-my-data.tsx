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
];

export function DeleteMyData() {
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
                ["data-pz", "data-pz-icons", "data-pz-detail", "data-pz-scheme"].forEach((a) => html.removeAttribute(a));
                html.classList.remove("dyslexic", "text-large", "calm", "reduce-motion", "focus-strong");
                setStep("done");
              } catch {
                setError(true);
              }
            }}
          >
            Yes, delete everything
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
