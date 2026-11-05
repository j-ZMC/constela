"use client";

import { useState } from "react";
import { EmployerPage } from "@/components/employers/employer-page";
import { useUrlValue } from "@/components/employers/list-detail";
import { VacancyEditor, unsavedForms } from "@/components/employers/vacancy-editor";
import { action, outlined, panel } from "@/components/employers/vacancy-fields";
import { Button } from "@/components/ui/button";
import { useEmployerData } from "@/lib/employer-store";
import { Loading } from "@/components/loading";
import { postingFactsLine } from "@/lib/posting-facts";
import { useHydrated } from "@/lib/use-hydrated";
import { emptyForm, formFromVacancy, leftText, thingsLeft } from "@/lib/vacancy-editor";

const INTRO = "Paste a job post, see what is missing, and publish a clear version.";

// Job posts live in localStorage, so the list waits for hydration; the sky and title don't.
export function VacancyWorkspace() {
  return useHydrated() ? (
    <Workspace />
  ) : (
    <EmployerPage title="Jobs" intro={INTRO}>
      <Loading />
    </EmployerPage>
  );
}

function Workspace() {
  const { vacancies } = useEmployerData();
  const [post, setPost] = useUrlValue("post");
  const [returned, setReturned] = useState(false);

  if (post) {
    const stored = vacancies.find((v) => v.id === post);
    return (
      <VacancyEditor
        key={post}
        start={stored ? formFromVacancy(stored) : emptyForm(post)}
        isNew={!stored}
        onClose={() => {
          // Clears the open part too.
          window.history.pushState(null, "", window.location.pathname);
          setReturned(true);
        }}
      />
    );
  }

  const kept = unsavedForms();
  const notStored = kept.filter((form) => !vacancies.some((v) => v.id === form.id));

  return (
    <EmployerPage title="Jobs" intro={INTRO}>
      <div className="flex flex-col items-start gap-3">
        {/* After the editor closes, focus returns here instead of falling back to the top of the page. */}
        <Button autoFocus={returned} className={action} onClick={() => setPost(crypto.randomUUID())}>
          Add a job post
        </Button>
        <p data-detail="extra" className="text-muted-foreground">{postingFactsLine()}</p>
      </div>
      {vacancies.length + notStored.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {notStored.map((form) => (
            <li key={form.id}>
              <Row title={form.title.trim() || "Job post with no title"} facts={["Not saved yet."]} onOpen={() => setPost(form.id)} />
            </li>
          ))}
          {vacancies.map((v) => (
            <li key={v.id}>
              <Row
                title={v.title}
                facts={[`${v.company}. ${v.status === "published" ? "Published." : "Draft."}`, kept.some((form) => form.id === v.id) ? "You have changes that are not saved." : leftText(thingsLeft(v))]}
                onOpen={() => setPost(v.id)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p>You have no job posts yet.</p>
      )}
    </EmployerPage>
  );
}

function Row({ title, facts, onOpen }: { title: string; facts: string[]; onOpen: () => void }) {
  return (
    <article className={`${panel} flex-row flex-wrap items-center justify-between`}>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold">{title}</h2>
        {facts.map((fact) => (
          <p key={fact}>{fact}</p>
        ))}
      </div>
      <Button variant="outline" className={outlined} aria-label={`Open ${title}`} onClick={onOpen}>
        Open
      </Button>
    </article>
  );
}
