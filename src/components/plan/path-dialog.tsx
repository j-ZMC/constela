"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Constellation } from "@/components/profile/constellation";
import { useSummaryMode } from "@/components/summary";
import { STAGE_NAMES, STAGE_STEPS, stageOf } from "@/lib/path";
import { STAGES, stepKey, type Plan, type Stage } from "@/lib/plan";

// The whole job search at a glance: five small constellations, and a way back to an earlier stage.
export function PathDialog({ plan, onBack, onClose }: { plan: Plan; onBack: (stage: Stage) => void; onClose: () => void }) {
  const at = STAGES.indexOf(stageOf(plan));
  const short = useSummaryMode();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-5 p-5 text-base sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl leading-tight font-semibold">Your path</DialogTitle>
          <DialogDescription className="text-base">
            {short
              ? "Five stages to your first reply."
              : "Five stages from getting ready to your first reply. After Follow up, you look for the next job."}
          </DialogDescription>
        </DialogHeader>
        <ol className="-mx-5 flex min-h-0 flex-col gap-4 overflow-y-auto px-5 py-1">
          {STAGES.map((stage, i) => {
            const defs = STAGE_STEPS[stage];
            const lit = defs.map((d) => plan.steps.some((s) => s.done && stepKey(s.id) === d.id));
            const status = i < at ? "Done" : i === at ? "Now" : "Coming up";
            return (
              <li key={stage} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h3 className="font-semibold">
                    {i + 1}. {STAGE_NAMES[stage]}
                  </h3>
                  <span className="text-sm text-muted-foreground">{status}</span>
                </div>
                <Constellation lit={lit} label={`${STAGE_NAMES[stage]}: ${lit.filter(Boolean).length} of ${lit.length} steps done`} />
                {i < at && (
                  <Button variant="outline" className="h-11 w-fit px-4 text-base" onClick={() => onBack(stage)}>
                    Go back to {STAGE_NAMES[stage]}
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
        {!short && <p className="text-sm text-muted-foreground">Going back adds that stage&apos;s steps again. Your stars stay.</p>}
      </DialogContent>
    </Dialog>
  );
}
