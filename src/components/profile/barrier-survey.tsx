"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { NEEDS_GROUPS, barrierSubtype, effectiveBarrierPreferences, loadBarrierPreferences, saveBarrierPreferences } from "@/lib/barrier-preferences";
import { loadProfile, toJobPreferences } from "@/lib/profile";
import { useHydrated } from "@/lib/use-hydrated";

export function BarrierSurvey() {
  return useHydrated() ? <Survey /> : null;
}

// An optional last step of the profile: things at work the job filter should point out.
// Grouped by everyday need, never by diagnosis. Each tap saves, like the questions above it.
function Survey() {
  const [fromProfile] = useState(() => loadBarrierPreferences() === null);
  const [selected, setSelected] = useState<string[]>(() => effectiveBarrierPreferences(toJobPreferences(loadProfile() ?? {}).barriers));
  const [status, setStatus] = useState("");

  function toggle(id: string, on: boolean) {
    const next = on ? [...selected, id] : selected.filter((x) => x !== id);
    setSelected(next);
    setStatus(saveBarrierPreferences(next) ? "Saved." : "Could not save in this browser.");
  }

  return (
    <section data-tour="profile-work" aria-labelledby="work-heading" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 id="work-heading" className="text-xl font-semibold">
          Anything at work you want us to point out?
        </h2>
        <p className="text-muted-foreground">
          Optional. When a job post mentions one of these, we mark it so you can check it. We never hide a job because of it.
        </p>
        {fromProfile && selected.length > 0 && (
          <p className="text-muted-foreground">We ticked a few from your answers. Change them as you like.</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {NEEDS_GROUPS.map((group) => {
          const count = group.ids.filter((id) => selected.includes(id)).length;
          return (
            <details key={group.id} className="group rounded-xl border bg-card" open={count > 0}>
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
                <ChevronRight aria-hidden className="size-5 shrink-0 transition-transform group-open:rotate-90" />
                <span className="flex-1">{group.label}</span>
                {count > 0 && <span className="text-muted-foreground">{count} chosen</span>}
              </summary>
              <fieldset className="flex flex-col gap-1 px-4 pb-4">
                <legend className="sr-only">{group.label}</legend>
                {group.ids.map((id) => {
                  const subtype = barrierSubtype(id);
                  if (!subtype) return null;
                  return (
                    <label key={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-2">
                      <Checkbox className="mt-0.5 size-5" checked={selected.includes(id)} onCheckedChange={(on) => toggle(id, on === true)} />
                      <span className="flex flex-col">
                        <span>{subtype.label_en}</span>
                        {/* Two real phrases from job posts make each option concrete. */}
                        <span className="text-sm text-muted-foreground">For example: {subtype.candidate_terms_en.slice(0, 2).join(", ")}</span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            </details>
          );
        })}
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {status}
      </p>
    </section>
  );
}
