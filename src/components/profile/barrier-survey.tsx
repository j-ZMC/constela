"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Flag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MAX_CUSTOM_BLOCKERS,
  barrierCatalog,
  loadBarrierPreferences,
  loadCustomBlockers,
  normalizeCustomBlocker,
  saveBarrierPreferences,
} from "@/lib/barrier-preferences";
import { useHydrated } from "@/lib/use-hydrated";
import { Loading } from "@/components/loading";

const SAVE_FAILED = "Could not save preferences in this browser.";

export function BarrierSurvey({ onNext }: { onNext: () => void }) {
  return useHydrated() ? <Survey onNext={onNext} /> : <Loading />;
}

function Survey({ onNext }: { onNext: () => void }) {
  const [selected, setSelected] = useState<string[]>(() => loadBarrierPreferences() ?? []);
  const [words, setWords] = useState<string[]>(loadCustomBlockers);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  const query = search.trim().toLocaleLowerCase("en");
  const categories = useMemo(
    () =>
      barrierCatalog.categories.flatMap((category) => {
        const categoryMatches = category.name_en.toLocaleLowerCase("en").includes(query);
        const subtypes = categoryMatches
          ? category.subtypes
          : category.subtypes.filter((subtype) =>
              [subtype.label_en, ...subtype.candidate_terms_en].some((text) => text.toLocaleLowerCase("en").includes(query)),
            );
        return subtypes.length ? [{ category, subtypes }] : [];
      }),
    [query],
  );
  const selectedOptions = useMemo(
    () =>
      barrierCatalog.categories.flatMap((category) =>
        category.subtypes
          .filter((subtype) => selected.includes(`${category.id}:${subtype.id}`))
          .map((subtype) => ({ id: `${category.id}:${subtype.id}`, category: category.name_en, label: subtype.label_en })),
      ),
    [selected],
  );

  // Saved on every change: leaving this tab must not lose a selection.
  function update(next: string[], nextWords = words) {
    setSelected(next);
    setWords(nextWords);
    setStatus(saveBarrierPreferences(next, nextWords) ? "" : SAVE_FAILED);
  }

  function toggle(id: string, checked: boolean) {
    update(checked ? [...selected.filter((item) => item !== id), id] : selected.filter((item) => item !== id));
  }

  function addWord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    const word = normalizeCustomBlocker(draft);
    if (!word) return setStatus("Use letters, numbers and spaces, up to 40 characters.");
    if (!words.includes(word)) {
      if (words.length >= MAX_CUSTOM_BLOCKERS) return setStatus(`You can add up to ${MAX_CUSTOM_BLOCKERS} words.`);
      update(selected, [...words, word]);
    }
    setDraft("");
  }

  // Saving here too, so "none of these" is a finished answer.
  function saveAndContinue() {
    if (saveBarrierPreferences(selected, words)) onNext();
    else setStatus(SAVE_FAILED);
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="barrier-heading">
      <header className="flex flex-col gap-2">
        <h2 id="barrier-heading" className="flex items-center gap-2 text-2xl font-semibold text-balance">
          <Flag aria-hidden className="size-7 shrink-0 text-primary" />
          Which workplace conditions should we flag?
        </h2>
        <p className="text-muted-foreground">
          Choose only what you want us to check in job postings. A flag asks you to look closer. It never rules a job out.
          You do not need a diagnosis.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <label>
          <span className="sr-only">Search job conditions</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search, for example: noise"
            autoComplete="off"
            className="h-11 w-full rounded-md border border-input bg-card px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        {categories.length ? (
          <div className="flex flex-col divide-y rounded-xl border bg-card">
            {categories.map(({ category, subtypes }) => (
              <details key={category.id} open={Boolean(query)}>
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-3 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span>{category.name_en}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {subtypes.length} {subtypes.length === 1 ? "option" : "options"}
                  </span>
                </summary>
                <div className="flex flex-col gap-3 px-4 pb-4">
                  {subtypes.map((subtype) => {
                    const id = `${category.id}:${subtype.id}`;
                    const isExpanded = expanded.includes(id);
                    return (
                      <div key={id}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-3">
                          <Checkbox checked={selected.includes(id)} onCheckedChange={(checked) => toggle(id, checked === true)} />
                          <span className="font-medium">{subtype.label_en}</span>
                        </label>
                        <div className="ml-7">
                          <Button
                            type="button"
                            variant="link"
                            className="h-11 p-0 text-sm"
                            aria-expanded={isExpanded}
                            onClick={() =>
                              setExpanded((current) =>
                                isExpanded ? current.filter((item) => item !== id) : [...current, id],
                              )
                            }
                          >
                            {isExpanded ? "Hide examples" : "Show examples"}
                          </Button>
                          {isExpanded && (
                            <ul className="flex flex-wrap gap-1.5" aria-label={`Examples for ${subtype.label_en}`}>
                              {subtype.candidate_terms_en.map((term) => (
                                <li key={term} className="rounded bg-secondary px-2 py-1 text-sm text-muted-foreground">
                                  {term}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p role="status" className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            No matching options. Try another search term.
          </p>
        )}
      </div>

      <section aria-labelledby="words-heading" className="flex flex-col gap-3">
        <div>
          <h3 id="words-heading" className="text-lg font-semibold">Your own words</h3>
          <p className="mt-1 text-muted-foreground">
            Anything else you want to avoid, like &ldquo;night shift&rdquo; or &ldquo;open office&rdquo;. We flag a job
            when its title or description has the exact word.
          </p>
        </div>
        <form onSubmit={addWord} className="flex gap-3">
          <label className="flex-1">
            <span className="sr-only">Add a word to flag</span>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={40}
              autoComplete="off"
              placeholder="For example: night shift"
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <Button type="submit" variant="outline" className="h-11 px-5 text-base" disabled={!draft.trim()}>
            Add
          </Button>
        </form>
        {words.length > 0 && (
          <ul aria-label="Your words" className="flex flex-wrap gap-2">
            {words.map((word) => (
              <li key={word} className="flex h-11 items-center rounded-full bg-secondary pl-4 text-base">
                {word}
                <button
                  type="button"
                  aria-label={`Remove ${word}`}
                  className="grid size-11 place-items-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => update(selected, words.filter((item) => item !== word))}
                >
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div aria-labelledby="selection-heading" role="group" className="flex flex-col gap-3">
        <h3 id="selection-heading" className="font-semibold">
          Selected: {selected.length + words.length}
        </h3>
        {selectedOptions.length > 0 && (
          <ul className="flex flex-col divide-y rounded-xl border bg-card px-4">
            {selectedOptions.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                <span>{item.category}: {item.label}</span>
                <button
                  type="button"
                  aria-label={`Remove ${item.label}`}
                  className="grid size-11 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => toggle(item.id, false)}
                >
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="button" className="h-11 px-5 text-base" onClick={saveAndContinue}>
            Save and continue
          </Button>
          {selected.length + words.length > 0 && (
            <Button type="button" variant="ghost" className="h-11 px-5 text-base" onClick={() => update([], [])}>
              Clear all
            </Button>
          )}
        </div>
        <p role="status" aria-live="polite" className="min-h-5 text-sm text-muted-foreground">{status}</p>
        <p className="text-sm text-muted-foreground">
          Saved on this device. When you search, Constela uses them to point out jobs to check. They never leave
          Constela.
        </p>
      </div>
    </section>
  );
}
