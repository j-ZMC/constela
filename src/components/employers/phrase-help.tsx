"use client";

import { useEffect, useRef, useState } from "react";
import { action } from "@/components/employers/vacancy-fields";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { rewriteLine } from "@/lib/employer-ai-client";
import { findExclusionaryPhrases } from "@/lib/vacancy";
import { hasBlank, markPhrases } from "@/lib/vacancy-editor";

// The pasted text with each vague phrase marked. The hints below it say the same in words, so color is never the only signal.
export function MarkedText({ text }: { text: string }) {
  const phrases = findExclusionaryPhrases(text);
  return (
    <div className="flex flex-col gap-3">
      <p className="whitespace-pre-line text-sm leading-relaxed">
        {markPhrases(text).map((part, i) =>
          part.marked ? (
            <mark key={i} className="rounded-sm bg-secondary px-0.5 font-semibold text-foreground underline decoration-2 underline-offset-2">
              {part.text}
            </mark>
          ) : (
            part.text
          ),
        )}
      </p>
      {phrases.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {phrases.map((p) => (
            <li key={p.id}>
              <strong className="font-semibold text-foreground">“{p.match}”:</strong> {p.hint}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type HelpProps = { text: string; maxLength: number; onUse: (text: string) => void };

// Under a line with a vague phrase: what to say instead, and a suggestion the employer has to accept.
export function PhraseHelp({ text, maxLength, onUse }: HelpProps) {
  const place = useRef<HTMLDivElement>(null);
  return (
    // The buttons that end a suggestion disappear with it, so focus rests here instead of falling back to the page.
    <div ref={place} tabIndex={-1} className="outline-none">
      {/* A suggestion belongs to one version of the line, so changing the line drops it. */}
      <Help key={text} text={text} maxLength={maxLength} onUse={onUse} onDone={() => place.current?.focus()} />
    </div>
  );
}

function Help({ text, maxLength, onUse, onDone }: HelpProps & { onDone: () => void }) {
  const [status, setStatus] = useState<"idle" | "loading" | "review" | "error">("idle");
  const [suggestion, setSuggestion] = useState("");
  const request = useRef<AbortController>(null);

  useEffect(() => () => request.current?.abort(), []);

  const phrases = findExclusionaryPhrases(text);
  if (phrases.length === 0) return null;

  function suggest() {
    const controller = new AbortController();
    request.current = controller;
    setStatus("loading");
    rewriteLine(text, controller.signal)
      .then((next) => {
        setSuggestion(next);
        setStatus("review");
      })
      .catch(() => setStatus(controller.signal.aborted ? "idle" : "error"));
  }

  const blank = hasBlank(suggestion);
  const tooLong = suggestion.length > maxLength;

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-secondary p-3 text-sm">
      <ul className="flex flex-col gap-1">
        {phrases.map((p) => (
          <li key={p.id}>
            <strong className="font-semibold">“{p.match}” is vague.</strong> {p.hint}
          </li>
        ))}
      </ul>

      {status === "review" ? (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5 font-medium">
            Suggested version. Nothing changes until you use it.
            <Textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              maxLength={maxLength}
              rows={2}
              autoFocus
              className="min-h-11 bg-card text-base font-normal md:text-base"
            />
          </label>
          {blank && <p>Replace each [bracket] with the real fact before you use this version.</p>}
          {tooLong && <p>Make this version shorter: it can have up to {maxLength} characters.</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              className={action}
              disabled={blank || tooLong || !suggestion.trim()}
              onClick={() => {
                onUse(suggestion.trim());
                onDone();
              }}
            >
              Use this version
            </Button>
            <Button
              variant="outline"
              className={action}
              onClick={() => {
                setStatus("idle");
                onDone();
              }}
            >
              Keep mine
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Stays in the page, so screen readers announce the message when it arrives. */}
          <p role="status">
            {status === "loading" && "Writing a clear version…"}
            {status === "error" && "We couldn't write a version right now. Try again, or use the hint above."}
          </p>
          <Button variant="outline" className={`${action} w-fit`} disabled={status === "loading"} onClick={suggest}>
            {status === "error" ? "Try again" : "Suggest a clear version"}
          </Button>
        </>
      )}
    </div>
  );
}
