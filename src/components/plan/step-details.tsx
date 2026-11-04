"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Duration, openLabel } from "@/components/plan/step-card";
import { completesItself, type PlanStep } from "@/lib/plan";

const action = "h-11 px-5 text-base";

// Opened from a star: what the step is, whether it's done, and a way to undo it.
export function StepDetails({
  step,
  onDone,
  onUndo,
  onRemove,
  onClose,
}: {
  step: PlanStep;
  onDone: () => void;
  onUndo: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const doneOn = step.doneAt && new Date(step.doneAt).toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-5 p-5 text-base sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl leading-tight font-semibold">{step.title}</DialogTitle>
          <DialogDescription className="text-base">
            {step.done ? (doneOn ? `Done on ${doneOn}.` : "Done.") : "Not done yet."}
          </DialogDescription>
          <Duration minutes={step.minutes} />
        </DialogHeader>
        <DialogFooter className="-mx-5 -mb-5 p-5">
          {/* A lit star is a record of something done: it can be marked not done, never deleted. */}
          {!step.done && (
            <Button variant="ghost" className={action} onClick={onRemove}>
              Remove
            </Button>
          )}
          {step.href && (
            <Link href={step.href} className={buttonVariants({ variant: "outline", className: action })}>
              {openLabel(step.href)}
            </Link>
          )}
          {step.done ? (
            <Button variant="outline" className={action} onClick={onUndo}>
              Mark as not done
            </Button>
          ) : (
            !completesItself(step.id) && (
              <Button className={action} onClick={onDone}>
                Done
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
