# NLP_Astralis — AI Context README

> Read this file first if you are an AI continuing work on this project.
> Project language: English for user-facing text, code, identifiers, schema, and documentation.
> Rules: do NOT run commands without asking. Do NOT modify code unless asked.

## 1. What this project is — and WHY

Job board + NLP filter as the backend for an **app that helps neurodivergent
people find work** (autism, ADHD, dyslexia, etc.). Job portals are hostile to
them: vague postings, hidden sensory/social load, unstructured interviews.

The NLP must do what OCC/LinkedIn never will:
- **Extract what matters:** async vs calls, remote vs open office, clear vs
  vague tasks, fixed vs flexible schedule, selection process type.
- **Translate to plain language:** "rockstar self-starter" -> actual tasks.
- **Block/flag:** user-blocked words AND semantic blocking (embeddings catch
  "cold calling" when user blocked "phone calls"). Strike-through display
  with reason tooltip.
- **Reduce overload:** top-N explained results, never infinite lists.
- **Company inclusion score:** Glassdoor Diversity & Inclusion rating joined
  to each vacancy (see §7).

Pipeline: `[sources] -> [collect_bulk.py] -> [jobs_*.json] -> [pretokenize.py or pretokenize_openai.py]
-> [filter_jobs.py or filter_jobs_openai.py] -> [ranked + blocked + scored jobs]`

## 2. Repository layout

| Path | Purpose |
|------|---------|
| `collect_bulk.py` | Main collector for 15+ sources; writes job data under `data/raw/jobs/` by default. |
| `filter_jobs.py` | One-by-one semantic job filter; strips HTML and skips empty descriptions before embedding/scoring. |
| `pretokenize.py` | Pre-encodes descriptions; stores vectors and URL index under `data/processed/embeddings/`. |
| `pretokenize_openai.py` | Uses `text-embedding-3-small` to cache job and barrier-subtype vectors for the cleaned USA backup dataset. |
| `filter_jobs_openai.py` | Filters from cached job/barrier vectors, embeds each search query with OpenAI, and excludes known non-qualifying companies using the two inclusion SQLite databases. |
| `data/raw/jobs/jobs_usa_full_backup_cleaned.json` | Cleaned copy of `jobs_usa_full_backup.json`; empty descriptions removed and HTML cleaned. The backup source remains unchanged. |
| `01_test.ipynb` | Embedding experiments. Kept in the root so existing workspace-relative paths continue to work. |
| `02_test.ipynb` | Original exploratory inclusion-score notebook; retained as a reference. |
| `company_inclusion.py` | Reproducible company-matching pipeline; compares both Glassdoor datasets and writes source-specific company scores to `data/processed/company_inclusion.sqlite` (`matched_companies` table). |
| `select_qualified_companies.py` | Exports employers meeting the Glassdoor threshold or matching another inclusion source, plus related jobs, to `data/processed/qualified_company_jobs.sqlite` (`selected_companies` and `related_jobs` tables). |
| `requirements.txt` | Direct third-party Python dependencies used by the project scripts. |
| `config/neurodivergence_job_barriers.json` | User-selected job-environment barrier terms and subtypes. |
| `data/raw/jobs/` | USA and Mexico job datasets. |
| `data/raw/research/` | LinkedIn dataset used for embedding experiments. |
| `data/raw/glassdoor/legacy/` | Older UK Glassdoor dataset. |
| `data/raw/glassdoor/current/` | Current Glassdoor reviews dataset (large; use `usecols` and `low_memory=False`). |
| `data/reference/company_data/` | B Corp and DEI reference JSON files. |
| `data/reference/source_docs/Temp_data/` | Source reports and reference documents formerly in `Temp_data/`. |
| `data/processed/embeddings/` | Cached USA job embeddings and URL index; includes the OpenAI cache for `jobs_usa_full_backup_cleaned.json`. |
| `.vscode/` | Workspace Python environment settings. |
| `__pycache__/` | Existing generated Python cache; left untouched. |

## 3. Environment (two Pythons exist)

- **Notebook env (use this):** conda `base` (miniconda3), Python 3.14.6,
  `torch 2.11+cu128`, `sentence-transformers 6.0`, `huggingface_hub 1.x`,
  `faiss-gpu 1.14`. GPU: RTX 5070 Laptop 8 GB, CUDA 12.8.
- **Terminal env (fragile):** Windows Store Python 3.12.10. Do NOT use for
  embeddings.
- Local Qwen embeddings run in the notebook kernel. The OpenAI embedding scripts can run from the terminal with `OPENAI_API_KEY` set. Collectors use stdlib `urllib`.

## 4. Job schema (all English keys)

```json
{
  "title": str, "company": str, "location": str, "modality": str,
  "salary_min": number|null, "salary_max": number|null, "currency": str,
  "description": str (<=4000 chars, HTML-cleaned),
  "url": str, "date": str, "source": str, "tags": [str]
}
```

Talenteca REMOVED (descriptions too short for NLP). Dice list descriptions
are salary-only; `collect_dice` has detail-fetch mode (`--dice-details`)
extracting real descriptions via `jobDescription...` pattern.

## 5. Collector sources (`collect_bulk.py`)

USA (rich descriptions): `greenhouse` (34 verified boards), `ashby` (45),
`lever` (only `spotify` alive), `usajobs` (needs `USAJOBS_KEY` env var),
`dice` (optional `DICE_API_KEY` env var; +details mode), `yc` (yc-oss + ATS resolve + SSR fallback),
`ziprss` (may hit Cloudflare).
Remote/global: `remoteok` (?tag=), `remotive`, `workingnomads`, `wwr`.
Mexico in-person: `computrabajo`, `occ`, `bumeran` (paged list+detail,
company/location extraction, <100char descriptions dropped),
`getonboard` (18 categories), `empleo-gob`, `linkedin` guest.
Excluded: Torre 401, Talenteca (removed), Wellfound/ZipRecruiter/Indeed
(need Playwright), JSearch (needs paid key).

Known bugs already fixed (do NOT reintroduce):
- Indentation: item-building MUST stay inside `for job in jobs`.
- `print/page += 1` MUST stay inside `while`.
- `return collected` MUST stay outside `for category`.
- `model.encode(str)` iterates chars — always pass a list.
- Tensors for `similarity()` MUST share device (all CUDA).

## 6. Semantic filter (current state)

- Model: `Qwen/Qwen3-Embedding-0.6B`, `device="cuda"`, fp16. 8B does NOT fit
  8GB VRAM (OOM); 8-bit path unsupported by sentence-transformers here.
- Affinity: English-only long query (flexible, written instructions,
  structured tasks, accommodations...), threshold `> 0.4` (was 0.35).
- Block dict, 8 categories, all-English keys (`social_overload`,
  `ambiguity`, `sensory`, `inflexibility`, `sales_pressure`,
  `exclusionary_hiring`, `physical_demand`, `financial_risk`), threshold 0.6.
- Pattern: `prompt_name="query"` for queries/blocks, docs plain;
  `similarity[0][0].item()` before `>` and f-strings; loop index from `-1`.
- User demands NO batching. Cached embeddings via `pretokenize.ensure_embeddings`
  + `emb_by_url` dict; missing URLs encoded live on same device.

### OpenAI API workflow

- Both scripts read `data/raw/jobs/jobs_usa_full_backup_cleaned.json` by default
  and print the path at startup. `--jobs` overrides this path.
- The cleaned file was derived from `jobs_usa_full_backup.json`: empty
  descriptions were removed and HTML was cleaned; the original backup was not
  modified.
- Set `OPENAI_API_KEY` in the environment, then run:

  ```powershell
  python pretokenize_openai.py
  python filter_jobs_openai.py --query "remote data analyst"
  ```

- `pretokenize_openai.py` creates job vectors, vectors for every selectable
  barrier subtype in `config/neurodivergence_job_barriers.json`, and three
  small work-modality prototypes (remote, on-site, hybrid). Job caches use
  `usa_full_backup_cleaned_openai_*` names so they do not mix with embeddings
  for other job files. Running it with the default settings reuses existing
  job/barrier vectors and only creates missing or stale modality vectors;
  `--rebuild` recomputes all caches and makes more API requests.
- `filter_jobs_openai.py` embeds the submitted search phrase once, then compares
  it with the cached modality prototypes. Clear remote/on-site/hybrid intent
  filters results by the JSON modality field; hybrid also includes remote.
  Unlabelled descriptions with remote similarity >= 0.50 are classified as
  remote; on-site searches also retain unlabelled jobs below that threshold,
  visibly marked as unspecified. If no modality intent is detected, search is
  not modality-filtered. The current dataset has only 348 explicit remote
  labels; the rest are unlabelled, so on-site results are not guaranteed to be
  confirmed on-site jobs.
- `filter_jobs_openai.py` treats the search-bar text as the similarity query
  and embeds it with one OpenAI API request per search. Quiz answers are passed
  as selected barrier IDs such as `autism_spectrum:sensory_load`; only those
  barrier subtypes can block results. Passing no IDs applies no personal
  blockers. The quiz/UI layer should store and send the IDs the user selects;
  category names are not inferred from a diagnosis.
- Its `filter_jobs()` function returns a JSON-ready dictionary with unblocked
  `jobs`, separate `blocked_jobs` (including selected barrier reasons), and a
  `summary` for web-backend integration. The CLI prints only unblocked jobs and
  reports the number of blocked similar jobs. Each job has `company_verified`
  (`true` only when its normalized company key is in `selected_companies`) and
  `company_verification_status` (`qualified`, `not_qualified`, or `unknown`).
  By default, known non-qualified companies are excluded before results are
  returned; unmatched companies remain eligible as `unknown`.
- The local Next.js app exposes this filter at `POST /api/jobs`. Keep
  `OPENAI_API_KEY` in the repository-root `.env.local`; set `PYTHON_EXECUTABLE`
  there to the Python interpreter with the backend requirements installed when
  `python` does not select that environment.
- The app reuses the precomputed job and barrier vectors on every search. Run
  `pretokenize_openai.py` offline only after updating the job dataset or barrier
  catalog; each submitted search embeds only its query once. The query is sent
  to OpenAI, while selected `user_blockers` are passed only to the local filter.
- `SIMILARITY_THRESHOLD` is a standard-deviation multiplier above the mean
  similarity (`2.0` by default): the cutoff is `mean + 2 * standard_deviation`.
  `BLOCKED_THRESHOLD` is currently `0.30`, so selected workplace blockers are intentionally more conservative and surface more jobs for review.

## 7. Company inclusion matching (`company_inclusion.py`)

- Compares `data/raw/glassdoor/current/all_reviews.csv` (9.9M rows; process
  by chunks) and `data/raw/glassdoor/legacy/glassdoor_reviews.csv`.
- Current dataset fields: `firm_link` and `Diversity & Inclusion`; legacy
  fields: `firm` and `diversity_inclusion`. Scores are stored separately in
  SQLite so the two populations are not silently blended.
- Normalizes employer names, aggregates scores with at least 10 ratings per
  dataset, and joins the Glassdoor, B Corp, and DEI reference sources.
- Matched companies are saved to `data/processed/company_inclusion.sqlite`,
  table `matched_companies`; unmatched employers are not labeled as bad.
- `select_qualified_companies.py` writes qualifying employers to
  `data/processed/qualified_company_jobs.sqlite`, table `selected_companies`;
  qualification requires Glassdoor D&I >= 3.7 in either dataset or a positive
  non-Glassdoor match. The OpenAI filter excludes only companies present in
  `matched_companies` but absent from `selected_companies`; unmatched employers
  remain eligible as unknown.
- Glassdoor scores are review-based signals, not verified measures of
  neurodivergent workplace accessibility.

## 8. Open tasks

1. Grow USA coverage (more Greenhouse/Ashby boards, Dice+details at scale).
2. Fuzzy company match to raise inclusion coverage above 8%.
3. Tune affinity/block thresholds against real jobs.
4. Per-sentence (not per-doc) blocking for precise strike-through.
5. Build the app: profile per neurotype, top-N explained ranking,
   strike-through rendering, save/compare-later, company flags.
6. Optional: Torre 401 fix, Playwright sources, DEI list as second signal.

## 9. User barrier selection demo

- `user_barriers.html` is a standalone English UI prototype for selecting
  one or more job-environment barrier subtypes from
  `config/neurodivergence_job_barriers.json`. It is a preference selector, not
  a diagnostic quiz; users can skip it or select options across categories.
- The page loads the JSON dynamically, shows example vacancy terms, and emits
  a `barriers-selected` browser event with `detail.user_blockers`, using IDs
  such as `autism_spectrum:sensory_load`. It also displays a JSON preview that
  can be connected to the user's profile and passed to `filter_jobs()`.
- To preview it, start a local web server from the project root and open
  `http://localhost:8000/user_barriers.html`:

  ```powershell
  python -m http.server 8000
  ```

- The catalog has 11 groups, but “neurodivergence” does not have one universally
  agreed list of exactly 11 diagnoses. Sensory preferences, giftedness, and
  trauma-related conditions are presented as optional workplace preferences,
  not as equivalent diagnoses.
- `candidate_terms_en` includes related wording variants modeled on job-ad
  language (for example, “customer-facing role”, “in-person customer service”,
  “rotating shifts”, and “varied shifts”). The form displays the full list.
  These are semantic embedding signals, not literal keywords that must appear
  in a posting.
- After changing the catalog terms, refresh the barrier vectors with
  `python pretokenize_openai.py`. This updates the barrier cache; the job cache
  is reused when it is already current.

## 10. Running scripts from the terminal

Run these commands in PowerShell from the project root. Activate the Python
environment you use for this project first.

### Install dependencies and set the OpenAI key

```powershell
python -m pip install -r requirements.txt
$env:OPENAI_API_KEY = "YOUR_OPENAI_API_KEY"
```

The PowerShell environment variable applies only to the current terminal
session. Do not commit the API key to the repository.

### Collect a small set of job postings (optional)

```powershell
python collect_bulk.py --sources greenhouse,ashby --query "data analyst" --limit 100 --out data/raw/jobs/jobs_bulk.json
```

For Dice collection, set its API key in the current terminal session:

```powershell
$env:DICE_API_KEY = "YOUR_DICE_API_KEY"
```

The collector supports other sources and options. Run this to view them:

```powershell
python collect_bulk.py --help
```

The collection command writes to the path given by `--out`.
The OpenAI scripts still use `jobs_usa_full_backup_cleaned.json` by default;
pass `--jobs data/raw/jobs/jobs_bulk.json` to both OpenAI commands if you want
to use the file produced by this collector. Use dedicated `--emb` and `--ids`
paths for a separate job-embedding cache.

### Prepare company databases

The OpenAI filter requires both company-inclusion SQLite databases. Build them
once, or skip these commands if the databases are already up to date:

```powershell
python company_inclusion.py
python select_qualified_companies.py
```

### Prepare OpenAI embeddings and search jobs

```powershell
python pretokenize_openai.py --jobs data/raw/jobs/jobs_usa_full_backup_cleaned.json
python filter_jobs_openai.py --jobs data/raw/jobs/jobs_usa_full_backup_cleaned.json --query "remote data analyst"
```

To apply the selected user blockers, repeat `--blocker` for each subtype ID:

```powershell
python filter_jobs_openai.py --jobs data/raw/jobs/jobs_usa_full_backup_cleaned.json --query "remote data analyst" --blocker autism_spectrum:sensory_load --blocker adhd:distraction_and_interruptions
```

After changing `config/neurodivergence_job_barriers.json`, run
`python pretokenize_openai.py` again to refresh its barrier vectors. Use
`python pretokenize_openai.py --rebuild` only when you intend to recompute all
job embeddings as well; that makes additional OpenAI API requests. CLI options
are available with `python pretokenize_openai.py --help` and
`python filter_jobs_openai.py --help`.

### Local Qwen pipeline (optional; CUDA environment required)

```powershell
python pretokenize.py --jobs data/raw/jobs/jobs_usa.json
python filter_jobs.py
```

`filter_jobs.py` uses the query and thresholds defined in the script; it does
not currently provide command-line flags. Run it with the environment that has
the local embedding model and CUDA dependencies installed.

### Preview the user barrier form

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/user_barriers.html` in a browser. Stop the
server with `Ctrl+C`.
