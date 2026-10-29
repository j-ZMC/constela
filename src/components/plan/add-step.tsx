"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const action = "h-11 px-5 text-base";

// The text lives in the parent so it survives a failed or cancelled break-down.
export function AddStep({
  value,
  onChange,
  onAdd,
  onBreakdown,
  breakdownFirst,
}: {
  breakdownFirst: boolean;
  value: string;
  onChange: (value: string) => void;
  onAdd: (title: string) => void;
  onBreakdown: (task: string) => void;
}) {
  const task = value.trim();
  // Closed by default: an open "add more" form is the kind of distraction Kairos warned about.
  const [open, setOpen] = useState(value !== "");
  if (!open) {
    return (
      <Button data-tour="add" variant="ghost" className={`${action} w-fit text-muted-foreground`} onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Add a step
      </Button>
    );
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!task) return;
        // Enter does whatever the filled-in button does.
        if (breakdownFirst) return onBreakdown(task);
        onAdd(task);
        setOpen(false);
      }}
    >
      <Label htmlFor="new-step" className="text-base font-semibold">
        Add a step
      </Label>
      <Input
        id="new-step"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={200}
        placeholder="For example: Prepare for my interview"
        className="h-11 text-base md:text-base"
        autoFocus
      />
      <div className="flex flex-wrap gap-3">
        <Button
          type={breakdownFirst ? "submit" : "button"}
          variant={breakdownFirst && task ? "default" : "outline"}
          className={action}
          disabled={!task}
          onClick={breakdownFirst ? undefined : () => onBreakdown(task)}
        >
          Break it down for me
        </Button>
        <Button
          type={breakdownFirst ? "button" : "submit"}
          variant={!breakdownFirst && task ? "default" : "outline"}
          className={action}
          disabled={!task}
          onClick={
            breakdownFirst
              ? () => {
                  onAdd(task);
                  setOpen(false);
                }
              : undefined
          }
        >
          Add as one step
        </Button>
        <Button type="button" variant="ghost" className={action} onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
    </form>
  );
}
