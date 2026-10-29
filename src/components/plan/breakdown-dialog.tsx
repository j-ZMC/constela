"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Duration } from "@/components/plan/step-card";
import { ListenButton } from "@/components/listen-button";
import type { NewStep, PlanStep } from "@/lib/plan";

// starter: which starter step is being broken down, so the server can tell the AI what that step means in Constela.
export type BreakdownFlags = { explicitSteps: boolean; summaryMode: boolean; gentleTone: boolean; starter?: string };
type Draft = { key: string; title: string; minutes: number };
type Status = "loading" | "review" | "error";

const action = "h-11 px-5 text-base";
const MANUAL_MINUTES = 5;
const draft = (title: string, minutes: number): Draft => ({ key: crypto.randomUUID(), title, minutes });

async function fetchSteps(task: string, flags: BreakdownFlags, signal: AbortSignal): Promise<Draft[]> {
  const res = await fetch("/api/breakdown", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, ...flags }),
    signal,
  });
  const data = await res.json();
  if (!res.ok || !Array.isArray(data?.steps)) throw new Error(data?.error ?? "failed");
  return data.steps.map((s: { title: string; minutes: number }) => draft(String(s.title), Number(s.minutes) || MANUAL_MINUTES));
}

// Mounted per request (keyed by the parent). Nothing reaches the plan until "Add these steps".
export function BreakdownDialog({
  task,
  flags,
  onAdd,
  onClose,
  listen = false,
}: {
  listen?: boolean;
  task: string;
  flags: BreakdownFlags;
  onAdd: (steps: NewStep[], source: PlanStep["source"]) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [steps, setSteps] = useState<Draft[]>([]);
  const [manual, setManual] = useState(false);
  const request = useRef<AbortController>(null);

  function load() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    // The route times out at 15 s; this only guards against a network that never answers.
    fetchSteps(task, flags, AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]))
      .then((s) => {
        setSteps(s);
        setStatus("review");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
  }

  // Ask once on open; abort if the dialog closes first.
  useEffect(() => {
    load();
    return () => request.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one request per mounted dialog
  }, []);

  function retry() {
    setStatus("loading");
    load();
  }

  function writeYourself() {
    setManual(true);
    setSteps([draft("", MANUAL_MINUTES)]);
    setStatus("review");
  }

  const edit = (key: string, title: string) => setSteps((all) => all.map((s) => (s.key === key ? { ...s, title } : s)));
  const remove = (key: string) => setSteps((all) => all.filter((s) => s.key !== key));
  const ready = steps.filter((s) => s.title.trim());

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* Never taller than the screen: the header and buttons stay put and only the steps scroll. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-5 p-5 text-base sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl leading-tight font-semibold">Break it down</DialogTitle>
          <DialogDescription className="text-base">{task}</DialogDescription>
        </DialogHeader>

        {status === "loading" && (
          <p role="status" className="text-muted-foreground">
            Making smaller steps…
          </p>
        )}

        {status === "error" && (
          <p role="alert">We couldn&apos;t break this down right now. Try again, or write the steps yourself.</p>
        )}

        {status === "review" && (
          <div className="-mx-5 flex min-h-0 flex-col gap-3 overflow-y-auto px-5 py-1">
            <p className="text-muted-foreground">
              {manual ? "Write one small step in each box." : "Check the steps. Change or remove any before you add them."}
            </p>
            {listen && !manual && ready.length > 0 && (
              <ListenButton text={ready.map((s, i) => `Step ${i + 1}: ${s.title}.`).join(" ")} label="Listen to the steps" />
            )}
            <ol className="flex flex-col gap-2">
              {steps.map((s, i) => (
                <li key={s.key} className="grid grid-cols-[1.5rem_1fr] items-start gap-x-1">
                  <span aria-hidden className="pt-2.5 font-medium text-muted-foreground">
                    {i + 1}.
                  </span>
                  <div className="flex flex-col">
                    {/* Grows with the text, so every word of a suggested step is readable before adding it. */}
                    <Textarea
                      value={s.title}
                      onChange={(e) => edit(s.key, e.target.value)}
                      // A step title is one line; it only wraps visually.
                      onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                      maxLength={80}
                      rows={1}
                      aria-label={`Step ${i + 1}`}
                      // The button that opened manual mode is gone; start typing in the first box.
                      autoFocus={manual && i === 0}
                      className="min-h-11 resize-none text-base md:text-base"
                    />
                    <div className="flex items-center justify-between">
                      <Duration minutes={s.minutes} />
                      <Button
                        variant="ghost"
                        className="h-11 px-3"
                        onClick={() => remove(s.key)}
                        disabled={steps.length === 1}
                        aria-label={`Remove step ${i + 1}`}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <Button variant="outline" className={`${action} w-fit`} onClick={() => setSteps((all) => [...all, draft("", MANUAL_MINUTES)])}>
              Add another step
            </Button>
          </div>
        )}

        <DialogFooter className="-mx-5 -mb-5 p-5">
          {status === "error" ? (
            <>
              <Button variant="ghost" className={action} onClick={onClose}>
                Cancel
              </Button>
              <Button variant="outline" className={action} onClick={writeYourself}>
                Write the steps yourself
              </Button>
              <Button className={action} onClick={retry}>
                Try again
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className={action} onClick={onClose}>
                Cancel
              </Button>
              <Button
                className={action}
                disabled={status !== "review" || ready.length === 0}
                onClick={() => onAdd(ready.map((s) => ({ title: s.title, minutes: s.minutes })), manual ? "user" : "ai")}
              >
                Add these steps
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
