"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Everything Constela keeps lives in this browser under these keys (profile, plan, reading and personalization).
// delete-my-data.test.ts fails if a key the app stores is not on this list.
export const DELETED_KEYS = [
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
  "employers",
];

// restart: after deleting, open the app fresh at the first form ("What is hard for you?" in the Profile), or at the
// employers' Home on their side. A full page load, not a client navigation: pages already visited stay mounted with
// what they knew about the person.
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
          <p className="w-full">
            This deletes your profile, CV data, plan, saved jobs, settings and any employer job posts on this device. If you
            published job posts, it also removes them from our server. It cannot be undone.
          </p>
          <Button
            variant="destructive"
            className="h-11 px-5 text-base"
            onClick={async () => {
              try {
                // A browser with no employer data has nothing on the server, and must not clear another employer's job posts.
                if (localStorage.getItem("employers")) await fetch("/api/employer-sync", { method: "DELETE" }).catch(() => {});
                DELETED_KEYS.forEach((k) => localStorage.removeItem(k));
                const html = document.documentElement;
                html.removeAttribute("style");
                ["data-pz", "data-pz-icons", "data-pz-detail", "data-pz-scheme", "data-pz-calm"].forEach((a) => html.removeAttribute(a));
                html.classList.remove("dyslexic", "text-large", "calm", "reduce-motion", "focus-strong");
                // A full load on purpose: router.push keeps visited pages mounted with the old data (cacheComponents).
                if (restart) return window.location.assign(window.location.pathname.startsWith("/employers") ? "/employers" : "/profile");
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
