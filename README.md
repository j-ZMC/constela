# Constela · by Astralis

**Find a job, one step at a time.**

Constela is an AI copilot that turns the job search into small, manageable steps for neurodivergent young adults, from building a profile to their first day at work. Every step is a star; together they form your constellation, your path to a job.

Built for the [North American AI Challenge](https://tech.asu.edu/na-ai-challenge) (ASU Enterprise Technology and the Spark Center for Innovation in Learning), with Kairos as our challenge partner.

## Why

The challenge asks for AI that supports **executive function**: planning, focus, task management and transitions. Job hunting is one of the heaviest executive-function tasks there is: many steps, deadlines, uncertainty, interview anxiety and a big routine change once you're hired.

## Modules

| Module | What it does | Route | Owner |
| --- | --- | --- | --- |
| Profile | A short onboarding about needs, not diagnoses | `/profile` | Luis |
| Personalization | Colors, text, cursor, icons, amount of information and motion, saved on the device ([PERSONALIZATION.md](PERSONALIZATION.md)) | Personalize panel | Regina |
| My plan | A five-stage job search path, up to 3 steps a day, a daily check-in and "Break it down for me" ([SPEC-plan.md](SPEC-plan.md), [SPEC-path.md](SPEC-path.md)) | `/plan` | Luis |
| Job filter backend | Cleaned US jobs dataset, barrier detection with embeddings and a company inclusion score ([backend/README.md](backend/README.md)) | `backend/` | Zahid |
| Jobs for you | Openings filtered by profile and explained in plain language, plus course suggestions | `/jobs` | Zahid & Juan |
| Interview | Guided practice, "What to expect" and "Translate this" for recruiter messages | `/interview` | Evy |
| LinkedIn extension (optional) | A "less chaotic" mode with the same look and settings | — | Regina |

AI lives inside each feature with a clear purpose instead of a blank chatbot, so nobody has to figure out what to ask.

## Design principles

- Adapt by needs, not by diagnosis.
- Calm by default: mint background, navy text, star gold only for achievements, no alarm red. Motion only on the intro.
- [Atkinson Hyperlegible](https://www.brailleinstitute.org/freefont/) as the main font; OpenDyslexic as an option.
- WCAG AA contrast on every text color.
- Respect the system "reduce motion" setting.

## Tech stack

[Next.js 16](https://nextjs.org) · [shadcn/ui](https://ui.shadcn.com) · [AI SDK](https://ai-sdk.dev) · Tailwind CSS · TypeScript

## Getting started

```bash
npm install
cp .env.example .env.local   # then add your API key
npm run dev
```

Open http://localhost:3000.

## Connecting your module to My plan

Everything lives in the browser, so modules talk to My plan through two functions in `src/lib/plan.ts`:

```ts
import { addStepToPlan, markEvent } from "@/lib/plan";

// Add a concrete next step. It shows first in My plan. `stage` is optional:
// "ready" | "search" | "apply" | "interview" | "follow-up".
addStepToPlan({ title: "Read the job at Acme", minutes: 5, icon: "briefcase", href: "/jobs", stage: "apply" });

// Say that something happened, so My plan can move to the next stage.
markEvent("job-saved");        // Jobs: a job was saved
markEvent("application-sent"); // Jobs: an application was sent
markEvent("practice-done");    // Interview: a practice question was answered
```

To adapt your screen to the person, read their profile:

```ts
import { loadProfile, toAdaptations, toJobPreferences } from "@/lib/profile";

const answers = loadProfile() ?? {};
const a = toAdaptations(answers);       // summaryMode, explicitSteps, stepsAtOnce, gentlePacing, ...
const jobs = toJobPreferences(answers); // { barriers: ["sound", ...], workplace: ["remote"] } for the job filter
```

Rules every screen follows: Easy Read copy (short sentences, verb first, no exclamation marks), 44 px targets, keyboard and screen-reader use, no red or "overdue", and AI only receives the text it needs, never profile answers or feelings.

## Team Astralis

Luis · Regina · Juan · Zahid · Evy
