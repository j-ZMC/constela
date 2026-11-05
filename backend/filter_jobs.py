"""Score and filter jobs using precomputed Qwen3-Embedding-0.6B vectors (Ollama, on this computer).

Run embed_jobs.py first to create/update the job and barrier caches.
Each search request embeds the user's free-text query with the same model through Ollama.

Usage:
  python embed_jobs.py
  python filter_jobs.py --query "remote data analyst"

For a web backend:
  from filter_jobs import filter_jobs
  payload = filter_jobs(
      query="remote data analyst",
      user_blockers=["autism_spectrum:sensory_load"],
  )
"""
from __future__ import annotations

import argparse
import contextlib
import json
import os
import re
import sqlite3
from typing import Any

import numpy as np
import pandas as pd

from embed_jobs import (
    BARRIERS_PATH as DEFAULT_BARRIERS_PATH,
    BARRIER_EMBEDDINGS_PATH as DEFAULT_BARRIER_EMBEDDINGS_PATH,
    EMBEDDING_DIMENSIONS,
    EMBEDDINGS_PATH as DEFAULT_EMBEDDINGS_PATH,
    IDS_PATH as DEFAULT_IDS_PATH,
    QUERY_TASK,
    clean_jobs,
    ollama_embed,
    with_task,
    expected_barriers,
    load_barrier_catalog,
)
from collect_bulk import pay_from_text
from company_inclusion import normalize_company

# Controls: edit these defaults, or override them with command-line options.
JOBS_PATH = "data/raw/jobs/jobs_usa_full_backup_cleaned.json"
BARRIERS_PATH = DEFAULT_BARRIERS_PATH
EMBEDDINGS_PATH = DEFAULT_EMBEDDINGS_PATH
IDS_PATH = DEFAULT_IDS_PATH
BARRIER_EMBEDDINGS_PATH = DEFAULT_BARRIER_EMBEDDINGS_PATH
COMPANY_INCLUSION_DB = "data/processed/company_inclusion.sqlite"
QUALIFIED_COMPANIES_DB = "data/processed/qualified_company_jobs.sqlite"
# Exclude matched companies absent from the qualifying-company database; unmatched stay eligible.
EXCLUDE_KNOWN_NON_INCLUSIVE = True
SIMILARITY_THRESHOLD = 2.0  # Number of standard deviations above the mean.
# Qwen3-Embedding-0.6B. At 0.40 (the threshold used with OpenAI's vectors) 12 of 33 conditions flagged under 10 jobs ("sound": 3).
# 0.35 set apart 3.6% of (condition, job) pairs ("sound": 58 jobs). Lowered to 0.33 on 5 November 2026 to flag more:
# 6.1% of pairs, 35 to 1,619 jobs per condition ("sound": 113). A flag only asks the person to look closer, so a
# few loose matches cost less than a missed one. At 0.32 (7.9%) unrelated jobs show more often.
# shortcut: tuned on what the flagged jobs look like, not checked with people; re-tune if it sets apart too much or too little.
BLOCKED_THRESHOLD = 0.33
# One threshold per condition, found by tune_thresholds.py (5 November 2026); a condition missing from the file uses
# BLOCKED_THRESHOLD, as do those where the evidence was too weak to move it.
BARRIER_THRESHOLDS_PATH = "config/barrier_thresholds.json"


def load_barrier_thresholds(path: str = BARRIER_THRESHOLDS_PATH) -> dict[str, float]:
    """Per-condition flag thresholds, by catalog ID. Empty when the file is missing."""
    try:
        with open(path, encoding="utf-8") as file:
            raw = json.load(file)
    except FileNotFoundError:
        return {}
    return {key: float(value) for key, value in raw.items() if isinstance(value, (int, float))}


def normalize_rows(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors / np.maximum(norms, 1e-12)


def load_embeddings(
    jobs: pd.DataFrame,
    emb_path: str,
    ids_path: str,
    barrier_emb_path: str,
    barriers_path: str,
) -> tuple[dict[str, np.ndarray], dict[str, np.ndarray], dict[str, dict[str, str]]]:
    for path in (emb_path, ids_path, barrier_emb_path):
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Embedding cache not found: {path}\n"
                "Create/update the caches first with: python embed_jobs.py"
            )

    job_vectors = np.load(emb_path)
    with open(ids_path, encoding="utf-8") as cache_file:
        job_ids = [str(value) for value in json.load(cache_file)]
    if (
        job_vectors.ndim != 2
        or job_vectors.shape[1] != EMBEDDING_DIMENSIONS
        or job_vectors.shape[0] != len(job_ids)
    ):
        raise ValueError(
            "The job embedding cache is invalid or uses another model. "
            "Recreate it with embed_jobs.py --rebuild."
        )

    expected_ids, expected_texts, expected_metadata = expected_barriers(barriers_path)
    with np.load(barrier_emb_path, allow_pickle=False) as barrier_cache:
        barrier_ids = barrier_cache["ids"].astype(str).tolist()
        barrier_texts = barrier_cache["texts"].astype(str).tolist()
        barrier_metadata_json = barrier_cache["metadata"].astype(str).tolist()
        barrier_vectors = barrier_cache["embeddings"]
    if (
        barrier_ids != expected_ids
        or barrier_texts != expected_texts
        or barrier_metadata_json != expected_metadata
        or barrier_vectors.shape != (len(expected_ids), EMBEDDING_DIMENSIONS)
    ):
        raise ValueError(
            "Quiz-barrier vectors are missing or outdated. "
            "Recreate them with embed_jobs.py."
        )

    needed_ids = set(jobs["url"].astype(str))
    missing_ids = needed_ids.difference(job_ids)
    if missing_ids:
        raise ValueError(
            f"The cache is missing {len(missing_ids)} job(s). "
            "Update it with embed_jobs.py before filtering."
        )

    job_vectors_by_url = {
        url: vector
        for url, vector in zip(job_ids, normalize_rows(job_vectors))
    }
    barrier_vectors_by_id = {
        barrier_id: vector
        for barrier_id, vector in zip(barrier_ids, normalize_rows(barrier_vectors))
    }
    barrier_metadata_by_id = {
        barrier["id"]: barrier for barrier in load_barrier_catalog(barriers_path)
    }
    return job_vectors_by_url, barrier_vectors_by_id, barrier_metadata_by_id


def embed_query(query: str) -> np.ndarray:
    """Embed one search-bar query with the same model and task as the job cache."""
    vector = np.asarray(ollama_embed([with_task(QUERY_TASK, query.replace("\n", " "))])[0], dtype=np.float32)
    if vector.shape != (EMBEDDING_DIMENSIONS,):
        raise ValueError(
            f"Expected a {EMBEDDING_DIMENSIONS}-dimensional query embedding; "
            f"received shape {vector.shape}."
        )
    return vector / max(float(np.linalg.norm(vector)), 1e-12)


# Work mode. Most postings leave `modality` empty, so it is read from the location, title and text too.
# The phrases are narrow on purpose: "hybrid cloud" or "on-site interview" are not about where you work.
# Not "remote work" or "work from home" alone: postings use them for perks ("15 days of remote work a year").
REMOTE_TEXT = re.compile(
    r"\b(fully remote|100% remote|remote[- ](first|friendly)|work from anywhere|"
    r"remote (role|position|job|opportunity|internship)|(role|position|job|internship) is (fully |100% )?remote)\b",
    re.IGNORECASE,
)
_DAYS = r"\d\+? (days?|times) (a|per) week"
HYBRID_TEXT = re.compile(
    r"\bhybrid (role|position|schedule|work(ing)?|model|arrangement|setup|policy|office|environment)\b|"
    r"\bhybrid\b[\s,:;-]+(on[- ]?site|in[- ]office|in the office|" + _DAYS + r")|"
    rf"\b{_DAYS}\b[^.]{{0,25}}\b(office|on[- ]?site|in[- ]person)\b|\b(office|on[- ]?site)\b[^.]{{0,25}}\b{_DAYS}\b",
    re.IGNORECASE,
)
ONSITE_TEXT = re.compile(r"\b(on[- ]?site|in[- ]office|in[- ]person)\b(?!\s+interview)|\b(in the office|office[- ]based)\b", re.IGNORECASE)
MODES = {"remote": "remote", "hybrid": "hybrid", "on_site": "on_site", "on-site": "on_site", "onsite": "on_site", "in office": "on_site"}


def work_mode(job: dict[str, Any]) -> str:
    """remote / hybrid / on_site when the posting says it plainly, *_inferred when only its text suggests it."""
    field = str(job.get("modality") or "").strip().lower()
    if field in MODES:
        return MODES[field]
    head = f"{job.get('title') or ''} {job.get('location') or ''}"
    if re.search(r"\bhybrid\b", head, re.IGNORECASE):
        return "hybrid"
    if re.search(r"\b(remote|work from home|wfh)\b", head, re.IGNORECASE):
        return "remote"
    if re.search(r"\b(on[- ]?site|in[- ]office)\b", head, re.IGNORECASE):
        return "on_site"
    text = str(job.get("description") or "")
    remote, hybrid, onsite = (bool(p.search(text)) for p in (REMOTE_TEXT, HYBRID_TEXT, ONSITE_TEXT))
    if hybrid or (remote and onsite):
        return "hybrid_inferred"
    if remote:
        return "remote_inferred"
    if onsite:
        return "on_site_inferred"
    return "unknown"


COMPANY_SIZES = "data/reference/company_data/company_sizes.json"


def load_company_sizes(path: str = COMPANY_SIZES) -> dict[str, dict[str, Any]]:
    """company_sizes.py's file: {"size": "small"|"medium"|"large"|None, "source": "bcorp"|"estimate"}. Optional."""
    try:
        with open(path, encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError:
        return {}


def job_pay(job: dict[str, Any] | pd.Series) -> dict[str, Any] | None:
    """A job's pay: its salary fields, or else a range its text gives (older files were collected without it)."""
    if pd.notna(job.get("salary_min")) or pd.notna(job.get("salary_max")):
        return {
            "salary_min": None if pd.isna(job.get("salary_min")) else float(job["salary_min"]),
            "salary_max": None if pd.isna(job.get("salary_max")) else float(job["salary_max"]),
            "currency": job.get("currency") or "",
            "salary_period": job.get("salary_period") if isinstance(job.get("salary_period"), str) else None,
        }
    return pay_from_text(job.get("description") or "")


def company_pay_examples(jobs: pd.DataFrame, company_keys: pd.Series, key: str, limit: int = 4) -> list[dict[str, Any]]:
    """What jobs at a company say they pay, so a job without pay still shows what the company pays."""
    examples = []
    for _, row in jobs.loc[company_keys == key].iterrows():
        pay = job_pay(row)
        if pay and pay["salary_min"] is not None and pay["salary_max"] is not None:
            examples.append({"title": str(row.get("title") or "")[:160], "url": str(row["url"]), **pay})
        if len(examples) == limit:
            break
    return examples


def custom_blocker_reasons(job: pd.Series, words: list[str]) -> list[dict[str, Any]]:
    """Block reasons for the person's own words found in a job's title or description.

    shortcut: whole-word text match, no stemming or synonyms ("night shift" does not
    match "night shifts"); upgrade to embeddings if people need meaning-based words.
    """
    text = f"{job.get('title', '')} {job.get('description', '')}"
    return [
        {
            "barrier_id": f"custom:{word}",
            "category_id": "custom",
            "category_name": "Your own words",
            "subtype_id": word,
            "label": f'Mentions "{word}"',
            "score": 1.0,
        }
        for word in words
        if re.search(rf"(?<!\w){re.escape(word)}(?!\w)", text, re.IGNORECASE)
    ]


def load_company_verification_sets(
    company_db_path: str, qualified_db_path: str
) -> tuple[set[str], set[str]]:
    for path in (company_db_path, qualified_db_path):
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Company inclusion database not found: {path}. "
                "Run company_inclusion.py and select_qualified_companies.py first."
            )

    try:
        with sqlite3.connect(company_db_path) as connection:
            matched = pd.read_sql_query(
                "SELECT firm_clean FROM matched_companies", connection
            )
        with sqlite3.connect(qualified_db_path) as connection:
            qualified = pd.read_sql_query(
                "SELECT firm_clean FROM selected_companies", connection
            )
    except (sqlite3.Error, pd.errors.DatabaseError) as error:
        raise RuntimeError(
            "Could not read matched_companies/selected_companies from the inclusion "
            "databases. Rebuild them with company_inclusion.py and "
            "select_qualified_companies.py."
        ) from error

    matched_keys = set(matched["firm_clean"].dropna().astype(str))
    qualified_keys = set(qualified["firm_clean"].dropna().astype(str))
    return matched_keys - qualified_keys, qualified_keys


FACT_COLUMNS = (
    "glassdoor_inclusion_mean",
    "glassdoor_reviews",
    "glassdoor_legacy_mean",
    "glassdoor_legacy_reviews",
    "bcorp_score",
    "dei_mx_score",
    "dei_us_2025_match",
)


def load_company_facts(qualified_db_path: str) -> dict[str, dict[str, float | None]]:
    """The inclusion scores behind each qualified company, for the app's "Get to know the company"."""
    with contextlib.closing(sqlite3.connect(qualified_db_path)) as connection:
        rows = pd.read_sql_query(
            f"SELECT firm_clean, {', '.join(FACT_COLUMNS)} FROM selected_companies", connection
        )
    facts = {}
    for row in rows.to_dict("records"):
        values = {column: pd.to_numeric(row[column], errors="coerce") for column in FACT_COLUMNS}
        # NaN is not valid JSON (the result is printed with allow_nan=False).
        facts[str(row["firm_clean"])] = {k: None if pd.isna(v) else float(v) for k, v in values.items()}
    return facts


def filter_jobs(
    query: str,
    user_blockers: list[str] | None = None,
    jobs_path: str = JOBS_PATH,
    emb_path: str = EMBEDDINGS_PATH,
    ids_path: str = IDS_PATH,
    barriers_path: str = BARRIERS_PATH,
    barrier_emb_path: str = BARRIER_EMBEDDINGS_PATH,
    company_db_path: str = COMPANY_INCLUSION_DB,
    qualified_db_path: str = QUALIFIED_COMPANIES_DB,
    similarity_std_multiplier: float = SIMILARITY_THRESHOLD,
    blocked_threshold: float = BLOCKED_THRESHOLD,
    exclude_known_non_inclusive: bool = EXCLUDE_KNOWN_NON_INCLUSIVE,
    custom_blockers: list[str] | None = None,
    barrier_thresholds: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Return JSON-ready results for a search query and quiz-selected barriers.

    `user_blockers` contains selected catalog IDs such as
    `autism_spectrum:sensory_load`. `custom_blockers` are words the person typed;
    a job that mentions one is flagged too. `jobs` contains unblocked results, while
    `blocked_jobs` contains matching jobs flagged by the selected barriers.
    """
    if not isinstance(query, str) or not query.strip():
        raise ValueError("A non-empty search query is required.")
    query = query.strip()

    jobs = clean_jobs(pd.read_json(jobs_path))
    jobs = jobs.drop_duplicates(subset="url", keep="first")
    input_jobs_count = len(jobs)
    excluded_jobs = 0
    excluded_companies = 0

    if "company" not in jobs.columns:
        raise ValueError(
            "The jobs file needs a 'company' column to apply SQL inclusion filters."
        )
    non_inclusive_keys, verified_company_keys = load_company_verification_sets(
        company_db_path, qualified_db_path
    )
    company_facts = load_company_facts(qualified_db_path)
    company_keys = jobs["company"].map(normalize_company)
    exclusion_mask = company_keys.isin(non_inclusive_keys)
    if exclude_known_non_inclusive:
        excluded_jobs = int(exclusion_mask.sum())
        excluded_companies = int(company_keys.loc[exclusion_mask].nunique())
        jobs = jobs.loc[~exclusion_mask].copy()

    company_keys_now = jobs["company"].map(normalize_company)
    pay_by_company: dict[str, list[dict[str, Any]]] = {}
    company_sizes = load_company_sizes()

    job_vectors, barrier_vectors, barrier_metadata = load_embeddings(
        jobs, emb_path, ids_path, barrier_emb_path, barriers_path
    )
    if isinstance(user_blockers, str):
        user_blockers = [user_blockers]
    selected_blocker_ids = list(dict.fromkeys(user_blockers or []))
    unknown_blockers = set(selected_blocker_ids).difference(barrier_vectors)
    if unknown_blockers:
        raise ValueError(
            "Unknown user blocker ID(s): " + ", ".join(sorted(unknown_blockers))
        )
    thresholds = load_barrier_thresholds() if barrier_thresholds is None else barrier_thresholds
    custom_words = list(
        dict.fromkeys(word.strip().lower() for word in custom_blockers or [] if word.strip())
    )
    query_vector = embed_query(query)
    selected_barriers = [
        (barrier_id, barrier_vectors[barrier_id], barrier_metadata[barrier_id])
        for barrier_id in selected_blocker_ids
    ]

    scores: list[float] = []
    scored_jobs: list[tuple[pd.Series, np.ndarray, float]] = []
    for _, row in jobs.iterrows():
        document_vector = job_vectors[str(row["url"])]
        score = float(np.dot(query_vector, document_vector))
        scores.append(score)
        scored_jobs.append((row, document_vector, score))

    if scores:
        mean_score: float | None = float(np.mean(scores))
        std_deviation: float | None = float(np.std(scores))
        similarity_cutoff: float | None = (
            mean_score + similarity_std_multiplier * std_deviation
        )
    else:
        mean_score = None
        std_deviation = None
        similarity_cutoff = None

    visible_jobs: list[dict[str, Any]] = []
    blocked_jobs: list[dict[str, Any]] = []
    scored_jobs.sort(key=lambda item: item[2], reverse=True)
    similarity_match_count = 0

    for row, document_vector, score in scored_jobs:
        if similarity_cutoff is None or score <= similarity_cutoff:
            continue
        similarity_match_count += 1
        block_reasons = []
        for barrier_id, barrier_vector, barrier in selected_barriers:
            barrier_score = float(np.dot(barrier_vector, document_vector))
            if barrier_score > thresholds.get(barrier_id, blocked_threshold):
                block_reasons.append(
                    {
                        "barrier_id": barrier_id,
                        "category_id": barrier["category_id"],
                        "category_name": barrier["category_name"],
                        "subtype_id": barrier["subtype_id"],
                        "label": barrier["label"],
                        "score": barrier_score,
                    }
                )
        block_reasons += custom_blocker_reasons(row, custom_words)

        job_data = json.loads(row.to_json(force_ascii=False, date_format="iso"))
        job_data["similarity"] = score
        job_data["similarity_rank"] = similarity_match_count
        job_data["blocked"] = bool(block_reasons)
        job_data["block_reasons"] = block_reasons
        company_key = normalize_company(job_data.get("company", ""))
        # collect_internships.py tags jobs whose company it took from the inclusion sources.
        job_data["company_verified"] = (
            company_key in verified_company_keys or "inclusion_verified" in (job_data.get("tags") or [])
        )
        job_data["company_facts"] = company_facts.get(company_key)
        job_data["modality_classification"] = work_mode(job_data)
        size = company_sizes.get(company_key) or {}
        job_data["company_size"] = {"size": size["size"], "source": size.get("source")} if size.get("size") else None
        job_data.update(job_pay(job_data) or {"salary_period": None})
        if company_key not in pay_by_company:
            pay_by_company[company_key] = company_pay_examples(jobs, company_keys_now, company_key)
        # Other jobs only: this job's own pay is already on its card.
        job_data["company_pay"] = [e for e in pay_by_company[company_key] if e["url"] != job_data.get("url")][:3]
        if job_data["company_verified"]:
            job_data["company_verification_status"] = "qualified"
        elif company_key in non_inclusive_keys:
            job_data["company_verification_status"] = "not_qualified"
        else:
            job_data["company_verification_status"] = "unknown"
        if block_reasons:
            blocked_jobs.append(job_data)
        else:
            visible_jobs.append(job_data)

    summary = {
        "query": query,
        "selected_blockers": selected_blocker_ids,
        "custom_blockers": custom_words,
        "input_jobs": input_jobs_count,
        "jobs_excluded_by_company": excluded_jobs,
        "companies_excluded": excluded_companies,
        "jobs_scored": len(scores),
        "similarity_matches": similarity_match_count,
        "blocked_similarity_matches": len(blocked_jobs),
        "visible_matches": len(visible_jobs),
        "verified_company_matches": sum(
            job["company_verified"] for job in visible_jobs + blocked_jobs
        ),
        "average_similarity": mean_score,
        "similarity_standard_deviation": std_deviation,
        "similarity_threshold": similarity_cutoff,
        "similarity_std_multiplier": similarity_std_multiplier,
        "blocked_threshold": blocked_threshold,
    }
    return {"jobs": visible_jobs, "blocked_jobs": blocked_jobs, "summary": summary}


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Search jobs and apply quiz-selected barrier blockers"
    )
    parser.add_argument("--query", required=True, help="Text entered in the search bar.")
    parser.add_argument(
        "--blocker",
        action="append",
        default=[],
        help="Quiz-selected barrier ID, e.g. autism_spectrum:sensory_load; repeatable.",
    )
    parser.add_argument(
        "--custom-blocker",
        action="append",
        default=[],
        help="A word that flags a job when its title or description mentions it; repeatable.",
    )
    parser.add_argument("--jobs", default=JOBS_PATH)
    parser.add_argument("--barriers", default=BARRIERS_PATH)
    parser.add_argument("--emb", default=EMBEDDINGS_PATH)
    parser.add_argument("--ids", default=IDS_PATH)
    parser.add_argument("--barrier-emb", default=BARRIER_EMBEDDINGS_PATH)
    parser.add_argument("--company-db", default=COMPANY_INCLUSION_DB)
    parser.add_argument("--qualified-db", default=QUALIFIED_COMPANIES_DB)
    parser.add_argument(
        "--json",
        dest="json_output",
        action="store_true",
        help="Print the search result as JSON for API integrations.",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=SIMILARITY_THRESHOLD,
        help=(
            "Standard-deviation multiplier above the mean similarity "
            f"(default: {SIMILARITY_THRESHOLD:g})."
        ),
    )
    parser.add_argument("--blocked-threshold", type=float, default=BLOCKED_THRESHOLD)
    args = parser.parse_args()

    if not args.json_output:
        print(f"Reading jobs JSON: {args.jobs}")
    result = filter_jobs(
        query=args.query,
        user_blockers=args.blocker,
        custom_blockers=args.custom_blocker,
        jobs_path=args.jobs,
        barriers_path=args.barriers,
        emb_path=args.emb,
        ids_path=args.ids,
        barrier_emb_path=args.barrier_emb,
        company_db_path=args.company_db,
        qualified_db_path=args.qualified_db,
        similarity_std_multiplier=args.threshold,
        blocked_threshold=args.blocked_threshold,
    )

    if args.json_output:
        print(json.dumps(result, ensure_ascii=False, allow_nan=False))
        return 0

    summary = result["summary"]
    if summary["jobs_excluded_by_company"]:
        print(
            f"Excluding {summary['jobs_excluded_by_company']} job(s) from "
            f"{summary['companies_excluded']} known non-inclusive companie(s) based on SQLite."
        )

    for job in result["jobs"]:
        print(f"[{job['similarity_rank']}] {job.get('title', '')} @ {job.get('company', '')}")
        print(f"    Location : {job.get('location', '')}")
        print(
            f"    Salary   : {job.get('salary_min', '')} - "
            f"{job.get('salary_max', '')} {job.get('currency', '')}"
        )
        print(
            f"    Source   : {job.get('source', '')} | "
            f"Score: {job['similarity']:.4f}"
        )
        print(f"    URL      : {job.get('url', '')}")
        print(f"    Desc     : {str(job.get('description', ''))[:200]}...")
        print("-" * 80)

    print("\n--- Similarity summary ---")
    print(f"Jobs excluded by company inclusion data: {summary['jobs_excluded_by_company']}")
    if summary["average_similarity"] is not None:
        print(f"Average similarity: {summary['average_similarity']:.4f}")
        print(
            "Similarity standard deviation: "
            f"{summary['similarity_standard_deviation']:.4f}"
        )
        print(
            f"SIMILARITY_THRESHOLD: {summary['similarity_threshold']:.4f} "
            f"(average + {args.threshold:g} SD)"
        )
    else:
        print("No jobs with descriptions were available to score.")
    print(f"Total jobs matching the similarity threshold: {summary['similarity_matches']}")
    print(f"Blocked similar jobs not shown: {summary['blocked_similarity_matches']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
