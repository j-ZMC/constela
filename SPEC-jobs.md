# Spec: Jobs search and results

## Objective

Replace the empty `/jobs` placeholder with search results from `backend/filter_jobs_openai.py`, using the existing cleaned jobs dataset, precomputed semantic embeddings, barrier catalog, and company-inclusion databases. A barrier match is a prompt to review a job, never an automatic rejection.

Users enter a job-search phrase, see matching openings, and can understand why a result was flagged. The jobs and barrier catalog are vectorized offline and their cache files are reused across searches. Each submitted search phrase is embedded once by OpenAI; selected barrier IDs are used by the local Python filter and are not sent to OpenAI.

## Contract

The web client submits only on explicit form submission:

```ts
POST /api/jobs
{ "query": "remote data analyst", "userBlockers": ["autism_spectrum:sensory_load"] }
```

The route validates a trimmed query (1–200 characters) and allowlists blocker IDs from the backend catalog. It invokes the Python filter without a shell, enforces a timeout, and returns a stable camelCase response with `jobs`, `blockedJobs`, and `summary`. Errors use generic machine-readable codes; internal traces and secrets never reach the client.

The server requires `OPENAI_API_KEY` and a Python environment with `backend/requirements.txt` dependencies. Set `PYTHON_EXECUTABLE` when `python` does not resolve to that environment. The OpenAI key stays server-side; until configured, the route returns a `not_configured` response and the page offers a clear setup message.

`pretokenize_openai.py` is an offline refresh step, run when the dataset, barrier catalog, or work-modality prototypes change. The request path must only load and reuse its existing caches; it must never regenerate job/barrier/modality vectors per search. The search phrase alone is embedded per request.

Work-modality intent is detected semantically by comparing the query vector to pre-vectorized remote, on-site, and hybrid prototypes. If no modality is detected, leave results unfiltered. Remote intent includes only explicitly remote jobs plus unlabelled jobs whose description-to-remote similarity is at least 0.50. Hybrid intent includes explicit hybrid and remote jobs, plus unlabelled jobs meeting the remote threshold. On-site intent includes explicit on-site jobs and unlabelled jobs below the remote threshold; high-confidence remote jobs are excluded. Unlabelled records below the threshold remain marked as unknown, not re-labeled as on-site. The current dataset has no explicit on-site or hybrid labels, so this conservative fallback can include unknown records in on-site searches as requested.

Each job card may show title, company, location, modality, salary when available, date, description, source, similarity rank, and company-verification status. External job links must be HTTP(S). Blocked results appear in a distinct review section with the backend's reason labels; unverified companies are not presented as non-inclusive.

The current backend provides no course catalog or generated job explanations. The page must not promise or fabricate either; use the cleaned job description and remove the unsupported course-recommendation copy.

## Tech Stack

Next.js 16 App Router route handler, React 19, TypeScript, existing Python filter, and existing OpenAI embedding integration. No new package dependencies.

## Commands

```text
Dev:   npm run dev
Build: npm run build
Lint:  npm run lint
Types: npx tsc --noEmit
Test:  npm test
```

## Project Structure

```text
backend/filter_jobs_openai.py       → existing semantic filter
backend/jobs_api.py                 → JSON stdin/stdout adapter for the filter
src/app/api/jobs/route.ts           → validated web API boundary and Python worker
src/components/jobs/job-search.tsx  → search form, result states, and job cards
src/lib/jobs.ts                     → request/response types and client request helper
src/app/jobs/page.tsx               → route composition
```

## Code Style

Validate at the HTTP boundary, keep Python subprocess arguments separate (never invoke a shell), and let React escape job text. Keep data fetching separate from result presentation. Example client contract:

```ts
type JobSearchResponse = {
  jobs: Job[];
  blockedJobs: Job[];
  summary: JobSearchSummary;
};
```

## Testing Strategy

- Unit-test query and blocker validation, error mapping, and response parsing.
- Test the route's missing-key, timeout, invalid-input, and successful-result behavior without making live OpenAI calls.
- Run the full Vitest, lint, and TypeScript checks; build the Next app.
- Verify `/jobs` in a browser: submit, loading, results, empty/error states, keyboard controls, and responsive layout.
- Live semantic search is only verifiable after `OPENAI_API_KEY` and the Python dependencies are configured; do not spend API credits during tests.

## Boundaries

- **Always:** keep the OpenAI key server-side; cap and validate incoming input; validate backend output before rendering; show barrier matches separately; preserve the user's choice; show meaningful loading, error, and empty states.
- **Ask first:** deployment beyond local/demo use, adding a course source, or sending profile barrier IDs to an external service.
- **Never:** interpolate request data into shell commands, expose traces/keys, render backend text as HTML, or hide a job solely because it matched a selected barrier.

## Success Criteria

- [ ] The `/jobs` placeholder is replaced by a search form and responsive result interface.
- [ ] Submitting a query reuses precomputed job/barrier vectors and invokes the Python semantic filter with only catalog-valid blocker IDs.
- [ ] Job/barrier/modality pre-vectorization is an offline refresh step, not part of each search request; only the search phrase is embedded per submitted search.
- [ ] NLP detects clear remote/on-site/hybrid intent; hybrid searches include hybrid and remote results, and queries without modality intent remain unfiltered.
- [ ] Unlabelled jobs with remote similarity >= 0.50 are inferred remote; on-site searches may include lower-confidence unlabelled jobs, which remain visibly marked as unspecified.
- [ ] Visible matches and barrier-flagged matches are presented separately with clear explanations.
- [ ] Company verification states distinguish qualified, not qualified, and unknown without overclaiming.
- [ ] No-result, missing-key, timeout, and generic failure states are understandable and accessible.
- [ ] No API key or barrier IDs are sent to OpenAI; only the search phrase is embedded.
- [ ] Automated checks pass, and live search works when the server key and Python environment are configured.

## Open Questions

None for the approved local/demo scope. A public deployment would need a separately hosted Python service plus authentication and shared rate limiting to protect the paid OpenAI endpoint.
