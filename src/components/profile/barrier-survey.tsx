"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { barrierCatalog, loadBarrierPreferences, saveBarrierPreferences } from "@/lib/barrier-preferences";
import { useHydrated } from "@/lib/use-hydrated";

export function BarrierSurvey() {
  return useHydrated() ? <Survey /> : null;
}

function Survey() {
  const [selected, setSelected] = useState<string[]>(() => loadBarrierPreferences() ?? []);
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
  const total = barrierCatalog.categories.reduce((sum, category) => sum + category.subtypes.length, 0);

  function toggle(id: string, checked: boolean) {
    setSelected((current) =>
      checked ? (current.includes(id) ? current : [...current, id]) : current.filter((item) => item !== id),
    );
    setStatus("");
  }

  function save() {
    setStatus(
      saveBarrierPreferences(selected)
        ? "Preferences saved on this device."
        : "Could not save preferences in this browser.",
    );
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="barrier-heading">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Job preferences</p>
        <h1 id="barrier-heading" className="mt-2 text-3xl font-bold text-balance">
          Which workplace conditions would you like us to flag?
        </h1>
        <p className="mt-3 text-muted-foreground">
          Choose only the situations you want the job filter to review. You can change your choices anytime.
        </p>
        <aside role="note" className="mt-4 rounded-lg border border-border bg-secondary p-4 text-sm leading-relaxed">
          <strong>This is not a diagnostic questionnaire.</strong> You do not need a diagnosis or to select an entire category.
          A match is a signal to review a job, not an automatic decision about whether it is right for you.
        </aside>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="catalog-heading" className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="catalog-heading" className="font-semibold">Select one or more job conditions</h2>
              <span className="text-sm text-muted-foreground">{total} conditions · {barrierCatalog.categories.length} categories</span>
            </div>
            <label className="mt-4 block">
              <span className="sr-only">Search job conditions</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search categories or job conditions…"
                autoComplete="off"
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <p className="mt-2 text-sm text-muted-foreground">
              Open a category to see its conditions and examples from job postings. The filter compares meaning; exact words do not have to appear.
            </p>
          </div>

          <div className="grid gap-2 p-3">
            {categories.length ? (
              categories.map(({ category, subtypes }) => (
                <details key={category.id} open={Boolean(query)} className="rounded-lg border">
                  <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-lg px-4 py-3 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span>{category.name_en}</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {subtypes.length} {subtypes.length === 1 ? "option" : "options"}
                    </span>
                  </summary>
                  <div className="grid gap-2 px-3 pb-3">
                    {subtypes.map((subtype) => {
                      const id = `${category.id}:${subtype.id}`;
                      const isExpanded = expanded.includes(id);
                      return (
                        <div key={id} className="rounded-md border p-3">
                          <label className="flex min-h-8 cursor-pointer items-start gap-3">
                            <Checkbox checked={selected.includes(id)} onCheckedChange={(checked) => toggle(id, checked === true)} />
                            <span className="text-sm font-medium leading-relaxed">{subtype.label_en}</span>
                          </label>
                          <div className="ml-7 mt-1">
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-sm"
                              aria-expanded={isExpanded}
                              onClick={() =>
                                setExpanded((current) =>
                                  isExpanded ? current.filter((item) => item !== id) : [...current, id],
                                )
                              }
                            >
                              {isExpanded ? "Hide examples" : "Show job-posting examples"}
                            </Button>
                            {isExpanded && (
                              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Examples for ${subtype.label_en}`}>
                                {subtype.candidate_terms_en.map((term) => (
                                  <li key={term} className="rounded bg-secondary px-2 py-1 text-xs text-muted-foreground">
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
              ))
            ) : (
              <p role="status" className="p-6 text-center text-sm text-muted-foreground">
                No matching options. Try another search term.
              </p>
            )}
          </div>
        </section>

        <aside aria-labelledby="selection-heading" className="rounded-xl border bg-card p-5 lg:sticky lg:top-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Your selection</p>
          <h2 id="selection-heading" className="mt-1 text-lg font-semibold">Profile preferences</h2>
          <p className="mt-2 text-sm text-muted-foreground">Selected conditions will be saved on this device.</p>
          <div className="mt-4 flex items-baseline justify-between rounded-lg bg-secondary p-3">
            <strong className="text-2xl">{selected.length}</strong>
            <span className="text-sm text-muted-foreground">conditions selected</span>
          </div>
          <ul className="my-3 max-h-52 divide-y overflow-auto" aria-live="polite">
            {selectedOptions.length ? (
              selectedOptions.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-2 py-2 text-sm">
                  <span>{item.category}: {item.label}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${item.label}`}
                    className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => toggle(item.id, false)}
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </li>
              ))
            ) : (
              <li className="py-2 text-sm text-muted-foreground">You have not selected any conditions yet.</li>
            )}
          </ul>
          <div className="flex flex-col gap-2">
            <Button type="button" onClick={save}>Save preferences</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelected([]);
                setStatus(saveBarrierPreferences([]) ? "Selection cleared." : "Could not save the cleared selection.");
              }}
            >
              Clear selection
            </Button>
          </div>
          <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-muted-foreground">{status}</p>
          <p className="mt-3 border-t pt-3 text-xs leading-relaxed text-muted-foreground">
            Your choices stay on this device. They are not sent to a server.
          </p>
        </aside>
      </div>
    </section>
  );
}
