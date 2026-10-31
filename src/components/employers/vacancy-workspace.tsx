"use client";

import { useState } from "react";
import { VacancyEditor } from "@/components/employers/vacancy-editor";
import { action } from "@/components/employers/vacancy-fields";
import { Button } from "@/components/ui/button";
import { useEmployerData } from "@/lib/employer-store";
import { useHydrated } from "@/lib/use-hydrated";
import { clarityScore, type Vacancy } from "@/lib/vacancy";
import { emptyForm, formFromVacancy, type VacancyForm } from "@/lib/vacancy-editor";

// Vacancies live in localStorage, so render only after hydration (same as the Profile flow).
export function VacancyWorkspace() {
  return useHydrated() ? <Workspace /> : null;
}

function Workspace() {
  const { vacancies } = useEmployerData();
  const [editing, setEditing] = useState<{ form: VacancyForm; isNew: boolean } | null>(null);
  const [returned, setReturned] = useState(false);

  if (editing) {
    return (
      <VacancyEditor
        key={editing.form.id}
        start={editing.form}
        isNew={editing.isNew}
        onClose={() => {
          setEditing(null);
          setReturned(true);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Your vacancies</h1>
        <p className="max-w-2xl text-muted-foreground">Paste a vacancy, see what is missing, and publish a clear version.</p>
      </div>
      {/* After the editor closes, focus returns here instead of falling back to the top of the page. */}
      <Button autoFocus={returned} className={`${action} w-fit`} onClick={() => setEditing({ form: emptyForm(crypto.randomUUID()), isNew: true })}>
        Add a vacancy
      </Button>
      {vacancies.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {vacancies.map((v) => (
            <li key={v.id}>
              <VacancyRow vacancy={v} onEdit={() => setEditing({ form: formFromVacancy(v), isNew: false })} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">You have no vacancies yet.</p>
      )}
    </div>
  );
}

function VacancyRow({ vacancy: v, onEdit }: { vacancy: Vacancy; onEdit: () => void }) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">
          {v.company} · {v.status === "published" ? "Published" : "Draft"}
        </p>
        <h2 className="mt-1 text-lg font-semibold">{v.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Clarity score: {clarityScore(v).score} of 100</p>
      </div>
      <Button variant="outline" className={action} aria-label={`Edit ${v.title}`} onClick={onEdit}>
        Edit
      </Button>
    </article>
  );
}
