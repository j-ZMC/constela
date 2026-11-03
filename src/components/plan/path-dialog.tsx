"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Constellation } from "@/components/profile/constellation";
import { useSummaryMode } from "@/components/summary";
import { BRANCH_NAMES, BRANCH_PREVIEW, OWN_NAME, PRIORITY, branchProgress, currentBranch } from "@/lib/path";
import { stepKey, type Branch, type Plan } from "@/lib/plan";

// Every branch at a glance: how far along it is, what it is for, and a way to work on it next.
export function PathDialog({ plan, onChoose, onClose }: { plan: Plan; onChoose: (branch: Branch | "own" | undefined) => void; onClose: () => void }) {
  const short = useSummaryMode();
  const working = currentBranch(plan);
  const own = plan.steps.filter((s) => !s.stage);
  const branches: Array<Branch | "own"> = [...PRIORITY, ...(own.length ? (["own"] as const) : [])];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-5 p-5 text-base sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl leading-tight font-semibold">All branches</DialogTitle>
          <DialogDescription className="text-base">
            {short
              ? "Work on any branch, in any order."
              : "Your job search has branches you can work on in any order. Today shows one step at a time from the branch you choose."}
          </DialogDescription>
        </DialogHeader>
        <ul className="-mx-5 flex min-h-0 flex-col divide-y overflow-y-auto px-5">
          {branches.map((b) => {
            const { done, total } =
              b === "own" ? { done: own.filter((s) => s.done).length, total: own.length } : branchProgress(plan, b);
            const lit = b === "own" ? own.map((s) => s.done) : Array.from({ length: total }, (_, i) => i < done);
            const name = b === "own" ? OWN_NAME : BRANCH_NAMES[b];
            const now = working === b;
            const waiting = b === "own" ? own.some((s) => !s.done) : plan.steps.some((s) => !s.done && s.stage === b && stepKey(s.id) !== "habit-jobs");
            return (
              <li key={b} className="flex flex-col gap-2 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h3 className="font-semibold">{name}</h3>
                  <span className="text-sm text-muted-foreground">
                    {done === total ? "Every step done" : `${done} of ${total} done`}
                    {now && " · Working on this now"}
                  </span>
                </div>
                <Constellation lit={lit} label={`${name}: ${done} of ${total} steps done`} />
                {!short && b !== "own" && <p className="text-pretty text-muted-foreground">{BRANCH_PREVIEW[b]}</p>}
                {!now && waiting && (
                  <Button variant="outline" className="w-fit" onClick={() => onChoose(b)}>
                    Work on this next
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {plan.focus && (
          <Button variant="ghost" className="w-fit" onClick={() => onChoose(undefined)}>
            Let Constela choose the next step
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
