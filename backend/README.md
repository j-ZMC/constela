# Constela backend

The Python side of Constela: job collectors, company inclusion data, the job search on local embeddings, and the voice
workers (Whisper and Kokoro). The Next.js app runs these scripts itself; there is no separate backend server. See the
main [README](../README.md) to set up.

## 1. What it is for

Job portals are hard to use for neurodivergent people: vague postings, hidden sensory and social load, unstructured
interviews. The backend does what general job boards do not:

- **Find what matters in a posting:** remote or in person, pay, company size, and whether the company has an inclusion
  signal.
- **Flag conditions the person chose to avoid:** semantic matching, so "cold calling" is caught when the person chose
  "phone calls". Flagged jobs are shown apart, with the reason.
- **Reduce overload:** the closest matches first, never an endless list.

Pipeline:

```
collect_bulk.py ─> data/raw/jobs/*.json ─> embed_jobs.py (Qwen3-Embedding-0.6B on Ollama) ─> vectors in data/processed/embeddings/
company_inclusion.py ─> select_qualified_companies.py ─> data/processed/*.sqlite
                                      └──────────────> filter_jobs.py (one run per search, from /api/jobs) ─> jobs + flagged jobs
```

Everything runs on this computer. The only script that calls an online AI is `company_sizes.py` (OpenAI `gpt-5-mini`),
which the team ran by hand; its answers are stored in `company_sizes.json` and the app never calls it.

## 2. Files

| Path | Purpose |
| --- | --- |
| `collect_bulk.py` | Collects jobs from 15+ sources into `data/raw/jobs/`. |
| `collect_internships.py` | Finds which inclusion-verified companies publish a Greenhouse, Lever or Ashby board, caches them in `data/reference/company_data/ats_boards.json`, and writes their internships to `data/raw/jobs/internships.json`. |
| `company_inclusion.py` | Matches employers against Glassdoor (two datasets), B Corp and DEI lists; writes `data/processed/company_inclusion.sqlite`. |
| `select_qualified_companies.py` | Keeps the employers that meet the inclusion bar, and their jobs: `data/processed/qualified_company_jobs.sqlite`. |
| `company_sizes.py` | Small / medium / large per company for the size filter (`data/reference/company_data/company_sizes.json`). Sources, best first: B Corp size band, Y Combinator `team_size`, the size the posting states, a `gpt-5-mini` estimate, and with `--web N` a web search for the N unknown companies with the most jobs. Needs `OPENAI_API_KEY`. |
| `embed_jobs.py` | Vectors for every job and every selectable workplace condition, with `qwen3-embedding:0.6b` on Ollama. |
| `filter_jobs.py` | One search: embeds the search words, ranks jobs, flags the conditions the person chose, adds pay, work mode and company facts. `--json` prints the result for `/api/jobs`. |
| `transcribe_server.py` | Whisper speech to text, plus the pauses and pace of an answer (no model) for "Adjust the practice". |
| `speak_server.py` | The AI's voice with Kokoro-82M (the model is in `models/kokoro/`). |
| `worker_protocol.py` | The JSON-lines protocol the two voice workers share with Next.js. |
| `resume_parser/` | The CV reader: `resume_parser.py` turns a PDF into name, email, skills, sectors, experience and projects, using `resume_taxonomy.json` (skills, and section headings in English and Spanish). The app sends the PDF on stdin (`--stdin-json`); nothing is saved. Its first version was based on [Vbhargav370/resume_parser.py](https://github.com/Vbhargav370/resume_parser.py), which has no license, so the parts that came from it were rewritten. |
| `setup_local.py` | One-command setup: `.venv`, Python packages, Whisper and the Ollama models. |
| `config/neurodivergence_job_barriers.json` | The workplace conditions a person can choose, with example wording from job ads. |
| `user_barriers.html` | A standalone prototype of the conditions picker (see section 7). |
| `test_*.py` | Tests: `..\.venv\Scripts\python.exe -m unittest discover -p "test_*.py"`. |

What the app reads at run time is in git: the job files in `data/raw/jobs/`, the two SQLite databases, the Qwen3
vectors and `company_sizes.json`. The Glassdoor datasets (`data/raw/glassdoor/`), research data (`data/raw/research/`)
and source reports (`data/reference/source_docs/`) are large third-party files kept out of git; they are only needed to
rebuild the company databases.

## 3. Environment

Python 3.10 or newer in `.venv` at the project root, with `requirements.txt` (`npm run setup` does it). Embeddings come
from Ollama (`qwen3-embedding:0.6b`) on the same computer; no API key. An NVIDIA GPU makes Whisper and Ollama faster
but is not required. Collectors use the standard library (`urllib`).

## 4. Job schema (all English keys)

```json
{
  "title": str, "company": str, "location": str, "modality": str,
  "salary_min": number|null, "salary_max": number|null, "currency": str,
  "salary_period": "hour"|"month"|"year"|null,  // collect_bulk.pay_from_text fills pay from the full text when a source has no salary fields; "$" currency = no code given
  "description": str (<=4000 chars, HTML-cleaned),
  "url": str, "date": str, "source": str, "tags": [str]
}
```

## 5. Collector sources (`collect_bulk.py`)

USA (rich descriptions): `greenhouse` (34 verified boards), `ashby` (45), `lever` (only `spotify` alive), `usajobs`
(needs `USAJOBS_KEY`), `dice` (optional `DICE_API_KEY`; `--dice-details` reads the full description), `yc` (yc-oss +
ATS resolve + SSR fallback), `ziprss` (may hit Cloudflare).
Remote/global: `remoteok`, `remotive`, `workingnomads`, `wwr`.
Mexico in person: `computrabajo`, `occ`, `bumeran`, `getonboard` (18 categories), `empleo-gob`.
Not used: LinkedIn and Indeed (their terms do not allow collecting their postings, so the collector has no code for
them and none of the jobs in this repository come from them), Torre (401), Talenteca (descriptions too short),
Wellfound / ZipRecruiter (need Playwright), JSearch (paid key).

Bugs already fixed in the collectors (do not reintroduce): item building stays inside `for job in jobs`; `page += 1`
stays inside `while`; `return collected` stays outside `for category`.

## 6. Job search with Qwen3-Embedding-0.6B

- **Model:** `qwen3-embedding:0.6b` through Ollama (`ollama pull qwen3-embedding:0.6b`), vectors of 1,024 numbers.
  Searches and condition texts get a one-line task in front (`QUERY_TASK`, `BARRIER_TASK` in `embed_jobs.py`); job
  descriptions go in plain.
- **Caches:** `data/processed/embeddings/*_qwen3_*`. `embed_jobs.py` reuses the job vectors when they are current and
  refreshes the condition vectors; `--rebuild` recomputes everything (a few minutes on the GPU).
- **Matching:** a job matches when its similarity to the search is `SIMILARITY_THRESHOLD` (2.0) standard deviations
  above the mean, so the cutoff adapts to each search.
- **Conditions:** the person's choices arrive as IDs such as `autism_spectrum:sensory_load`; only those can flag a job,
  at `BLOCKED_THRESHOLD` (0.35). Words the person types (`--custom-blocker=...`) match whole words. Nothing is inferred
  from a diagnosis.
- **Companies:** each job gets `company_verified` (in `selected_companies`) and `company_verification_status`
  (`qualified`, `not_qualified` or `unknown`). Known non-qualified companies are left out; unmatched ones stay as
  `unknown`.
- **Output:** `filter_jobs()` returns `jobs`, `blocked_jobs` (with the reasons) and a `summary`. With `--json` the
  script prints only that result to stdout; diagnostics go to stderr, because `/api/jobs` parses stdout.

## 7. Company inclusion matching (`company_inclusion.py`)

- Compares `data/raw/glassdoor/current/all_reviews.csv` (9.9M rows, read in chunks) and
  `data/raw/glassdoor/legacy/glassdoor_reviews.csv`. Scores from the two are stored apart, not blended.
- Normalizes employer names, keeps scores with at least 10 ratings, and joins the Glassdoor, B Corp and DEI sources into
  `matched_companies`; unmatched employers are not labeled as bad.
- `select_qualified_companies.py` keeps employers with Glassdoor D&I >= 3.7 in either dataset or a positive
  non-Glassdoor match (`selected_companies`). The job search leaves out only companies in `matched_companies` that are
  not in `selected_companies`.
- Glassdoor scores are review-based signals, not verified measures of neurodivergent workplace accessibility.

## 8. The conditions picker prototype (`user_barriers.html`)

A standalone page to choose workplace conditions from `config/neurodivergence_job_barriers.json`. It is a preference
picker, not a diagnostic quiz: people can skip it or choose across groups. It emits a `barriers-selected` event with
IDs such as `autism_spectrum:sensory_load`. The app's own picker is in Profile, Job conditions.

`candidate_terms_en` holds wording variants from job ads ("customer-facing role", "rotating shifts"). They are signals
for the embeddings, not keywords that must appear. After changing them, run `embed_jobs.py` to refresh the condition
vectors.

To preview it: `python -m http.server 8000` from `backend/`, then open `http://localhost:8000/user_barriers.html`.

## 9. Running the scripts

In PowerShell from `backend/`, with the project's environment (`..\.venv\Scripts\python.exe`, shown as `python` here).

```powershell
# Collect jobs (optional; the repository already has a snapshot)
python collect_bulk.py --sources greenhouse,ashby --query "data analyst" --limit 100 --out data/raw/jobs/jobs_bulk.json
python collect_bulk.py --help

# Company databases (needs the Glassdoor files, which are not in git)
python company_inclusion.py
python select_qualified_companies.py

# Vectors, then a search
python embed_jobs.py
python filter_jobs.py --query "remote data analyst"
python filter_jobs.py --query "remote data analyst" --blocker autism_spectrum:sensory_load --blocker adhd:distraction_and_interruptions

# Internships (run weekly: they are seasonal)
python collect_internships.py
python embed_jobs.py --jobs data/raw/jobs/internships.json --emb data/processed/embeddings/internships_qwen3_embeddings.npy --ids data/processed/embeddings/internships_qwen3_ids.json
```

Both job scripts read `data/raw/jobs/jobs_usa_full_backup_cleaned.json` by default; `--jobs`, `--emb` and `--ids`
point them at another file and its own vectors. `--help` lists every option.

## 10. History

- The first local filter (`pretokenize.py`, `filter_jobs.py` with PyTorch and sentence-transformers) was replaced by
  OpenAI `text-embedding-3-small`, and in November 2026 by Qwen3-Embedding-0.6B on Ollama, so the search runs on this
  computer. The scripts were renamed from `pretokenize_openai.py` and `filter_jobs_openai.py` to `embed_jobs.py` and
  `filter_jobs.py` when the OpenAI part was gone.

## 11. Open tasks

1. Grow USA coverage (more Greenhouse and Ashby boards, Dice with details at scale).
2. Fuzzy company matching, to raise inclusion coverage above 8%.
3. Tune the match and flag thresholds against real jobs.
4. Flag per sentence instead of per posting, to show exactly which part matched.
5. Optional: Torre, Playwright sources, the DEI list as a second signal.
