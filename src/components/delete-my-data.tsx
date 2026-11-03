"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

// Everything Constela keeps lives in this browser under these keys. A test fails if a new key isn't listed here.
export const DELETED_KEYS = [
  "profile",
  "profile-step",
  "job-barrier-preferences",
  "account-profile",
  "resume-profile",
  "recommended-jobs-cache",
  "saved-jobs",
  "job-wants",
  "plan",
  "tour",
  "a11y",
  "pz",
  "pz-boot",
  "employers",
];

const noUpdates = () => () => {};

export function DeleteMyData() {
  const [confirming, setConfirming] = useState(false);
  const done = useSyncExternalStore(noUpdates, () => window.location.hash === "#deleted", () => false);
  if (done) return <p role="status">Your data is deleted from this device.</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {!confirming ? (
        <Button variant="outline" className="h-11 px-5 text-base" onClick={() => setConfirming(true)}>
          Delete my data
        </Button>
      ) : (
        <>
          <p className="w-full">This deletes your profile, your CV, your plan, your settings and any employer vacancies on this device. It cannot be undone.</p>
          <Button
            variant="destructive"
            className="h-11 px-5 text-base"
            onClick={() => {
              try {
                DELETED_KEYS.forEach((k) => localStorage.removeItem(k));
              } catch {
                // Storage blocked: there was nothing saved to delete.
              }
              // Next keeps visited pages alive, so a reload is what also clears their memory and the settings applied to this page.
              window.location.hash = "deleted";
              window.location.reload();
            }}
          >
            Yes, delete everything
          </Button>
          <Button variant="ghost" className="h-11 px-5 text-base" onClick={() => setConfirming(false)}>
            Keep my data
          </Button>
        </>
      )}
    </div>
  );
}
