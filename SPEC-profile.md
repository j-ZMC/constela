# Spec: Profile

Status: draft, waiting for team review · Owner: Luis (with Regina for the adaptations)

## Objective

Let job seekers choose workplace conditions they want the job filter to flag for review, using the catalog already maintained by the backend. A match is a signal to review a job, not an automatic decision about whether it is right for the person.

**User:** a job seeker who wants to control which workplace conditions the filter reviews.

**Success looks like:** users can search and select individual conditions, understand examples from job postings, and save their choices on their own device.

### User stories

- As a user, I can select individual conditions without selecting an entire category.
- As a user, I can search the catalog and view examples of how conditions may appear in job postings.
- As a user, I can clear or save any selection, including an empty one.
- As a user, my preferences stay on my device and are not sent to a server.

## Assumptions

1. Web app only (Next.js), responsive for phone and desktop. No accounts or database for the demo.
2. Preferences are stored in `localStorage` on the device.
3. The catalog groups conditions by category, but the survey is not diagnostic and does not infer a diagnosis.
4. The form reads `backend/config/neurodivergence_job_barriers.json` and does not send selections to the backend.
5. All UI text is in English and uses plain language.

## Barrier catalog

The profile uses the categories and workplace-condition subtypes in `backend/config/neurodivergence_job_barriers.json`. Every condition is optional. The accompanying `backend/user_barriers.html` is the reference for the search, examples, selection summary, and non-diagnostic explanation.

Selections use the backend's `category_id:subtype_id` identifiers. Categories are only groups for browsing; a user chooses conditions, not a diagnosis.

## How selections are stored

The app saves `{ "user_blockers": ["category_id:subtype_id"] }` in `localStorage` on the device. It does not send these preferences to a server. The job filter can consume those IDs when a backend connection is added.

The prior question-based adaptation helpers remain available for existing saved profiles, but the profile screen now collects job-condition preferences instead.

## Interface

1. Explain that the preferences flag job conditions for review, are not diagnostic, and stay on the device.
2. Show the searchable catalog with collapsible categories, optional job-posting examples, and checkboxes for individual conditions.
3. Show a live selection count and removable selected conditions; let the user clear or save an empty selection.
4. Save preferences locally and report success or storage failure accessibly.

The catalog and selection summary must remain responsive, keyboard accessible, and usable with a screen reader. A match is a signal to review a job, not an automatic decision to hide it.

## Tech Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui (base-nova), and lucide-react. No new dependencies are needed.

## Commands

```
Dev:   npm run dev
Build: npm run build
Lint:  npm run lint
Types: npx tsc --noEmit
Test:  npm test
```

## Project Structure

```
src/app/profile/page.tsx                    → profile survey route
src/components/profile/barrier-survey.tsx   → searchable catalog and selection UI
src/lib/barrier-preferences.ts               → catalog types and local preference storage
src/lib/barrier-preferences.test.ts          → catalog and storage tests
backend/config/neurodivergence_job_barriers.json → source of selectable conditions
```

## Code Style

Match the existing code: function components, Tailwind classes, shadcn components, and short comments only for the why. Existing question-based adaptation helpers remain in `src/lib/profile.ts` for previously saved profiles.

## Testing Strategy

- Unit-test catalog IDs and preference validation, plus save/load behavior including an empty selection.
- Run Vitest, lint, and TypeScript checks.
- Check the survey in a browser at phone and desktop widths, with keyboard-only navigation.

## Boundaries

- **Always:** allow an empty selection; store preferences only on the device; preserve the non-diagnostic explanation; keep the UI keyboard and screen-reader usable.
- **Ask first:** adding dependencies or sending preferences to a server or AI provider.
- **Never:** infer a diagnosis, automatically reject a job from a match, or treat a whole category as selected when the user picks one condition.

## Success Criteria

- [ ] Every selectable subtype comes from the backend JSON catalog.
- [ ] Search finds categories, conditions, and job-posting examples.
- [ ] Users can select/remove conditions and save or clear their preferences.
- [ ] Preferences survive reload, including a saved empty selection.
- [ ] The survey works at mobile and desktop widths with keyboard and screen-reader access.
- [ ] No profile data leaves the device.

## Open Questions

1. What backend interface will consume the saved `user_blockers` IDs when the demo is connected to the job filter?
