"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Everything Constela keeps lives in this browser under these keys (profile, plan, reading and personalization).
const KEYS = ["profile", "profile-step", "plan", "a11y", "pz", "pz-boot"];

export function DeleteMyData() {
  const [step, setStep] = useState<"idle" | "confirm" | "done">("idle");
  if (step === "done") return <p role="status">Your data is deleted from this device.</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {step === "idle" ? (
        <Button variant="outline" className="h-11 px-5 text-base" onClick={() => setStep("confirm")}>
          Delete my data
        </Button>
      ) : (
        <>
          <p className="w-full">This deletes your profile, your plan and your settings on this device. It cannot be undone.</p>
          <Button
            variant="destructive"
            className="h-11 px-5 text-base"
            onClick={() => {
              try {
                KEYS.forEach((k) => localStorage.removeItem(k));
              } catch {
                // Storage blocked: there was nothing saved to delete.
              }
              // Drop the settings already applied to this page too.
              const html = document.documentElement;
              html.removeAttribute("style");
              ["data-pz", "data-pz-icons", "data-pz-detail"].forEach((a) => html.removeAttribute(a));
              html.classList.remove("dyslexic", "text-large", "calm", "reduce-motion", "focus-strong");
              setStep("done");
            }}
          >
            Yes, delete everything
          </Button>
          <Button variant="ghost" className="h-11 px-5 text-base" onClick={() => setStep("idle")}>
            Keep my data
          </Button>
        </>
      )}
    </div>
  );
}
