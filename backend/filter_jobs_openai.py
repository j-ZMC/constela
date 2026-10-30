"""Score and filter jobs using precomputed OpenAI embeddings.

Run pretokenize_openai.py first to create/update the job and barrier caches.
Each search request embeds the user's free-text query through the OpenAI API.

Usage:
  python pretokenize_openai.py
  python filter_jobs_openai.py --query "remote data analyst"

For a web backend:
  from filter_jobs_openai import filter_jobs
  payload = filter_jobs(
      query="remote data analyst",
      user_blockers=["autism_spectrum:sensory_load"],
  )
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
from typing import Any

import numpy as np
import pandas as pd

from pretokenize_openai import (
    BARRIERS_PATH as DEFAULT_BARRIERS_PATH,
    BARRIER_EMBEDDINGS_PATH as DEFAULT_BARRIER_EMBEDDINGS_PATH,
    MODALITY_EMBEDDINGS_PATH as DEFAULT_MODALITY_EMBEDDINGS_PATH,
    EMBEDDING_DIMENSIONS,
    EMBEDDINGS_PATH as DEFAULT_EMBEDDINGS_PATH,
    IDS_PATH as DEFAULT_IDS_PATH,
    MODEL_NAME,
    clean_jobs,
    expected_barriers,
    load_barrier_catalog,
)
from company_inclusion import normalize_company
from work_modality import (
    MODALITY_IDS,
    MODALITY_PROTOTYPES,
    classify_job_modality,
    cosine_scores,
    infer_query_modalities,
    modality_matches,
)

# Controls: edit these defaults, or override them with command-line options.
JOBS_PATH = "data/raw/jobs/jobs_usa_full_backup_cleaned.json"
BARRIERS_PATH = DEFAULT_BARRIERS_PATH
EMBEDDINGS_PATH = DEFAULT_EMBEDDINGS_PATH
IDS_PATH = DEFAULT_IDS_PATH
BARRIER_EMBEDDINGS_PATH = DEFAULT_BARRIER_EMBEDDINGS_PATH
MODALITY_EMBEDDINGS_PATH = DEFAULT_MODALITY_EMBEDDINGS_PATH
COMPANY_INCLUSION_DB = "data/processed/company_inclusion.sqlite"
QUALIFIED_COMPANIES_DB = "data/processed/qualified_company_jobs.sqlite"
# Exclude matched companies absent from the qualifying-company database; unmatched stay eligible.
EXCLUDE_KNOWN_NON_INCLUSIVE = True
SIMILARITY_THRESHOLD = 2.0  # Number of standard deviations above the mean.
BLOCKED_THRESHOLD = 0.30


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
                "Create/update the caches first with: python pretokenize_openai.py"
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
            "Recreate it with pretokenize_openai.py --rebuild."
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
            "Recreate them with pretokenize_openai.py."
        )

    needed_ids = set(jobs["url"].astype(str))
    missing_ids = needed_ids.difference(job_ids)
    if missing_ids:
        raise ValueError(
            f"The cache is missing {len(missing_ids)} job(s). "
            "Update it with pretokenize_openai.py before filtering."
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


def load_modality_embeddings(path: str = MODALITY_EMBEDDINGS_PATH) -> dict[str, np.ndarray]:
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Work-modality embedding cache not found: {path}. "
            "Run pretokenize_openai.py to create it."
        )
    with np.load(path, allow_pickle=False) as cache:
        modality_ids = cache["ids"].astype(str).tolist()
        modality_texts = cache["texts"].astype(str).tolist()
        embeddings = cache["embeddings"]
    expected_ids = list(MODALITY_IDS)
    expected_texts = [MODALITY_PROTOTYPES[modality] for modality in expected_ids]
    if (
        modality_ids != expected_ids
        or modality_texts != expected_texts
        or embeddings.shape != (len(expected_ids), EMBEDDING_DIMENSIONS)
    ):
        raise ValueError("Work-modality embeddings are outdated. Run pretokenize_openai.py again.")
    return {
        modality: vector
        for modality, vector in zip(modality_ids, normalize_rows(embeddings))
    }


def embed_query(query: str) -> np.ndarray:
    """Embed one search-bar query with OpenAI's configured embedding model."""
    from openai import OpenAI

    response = OpenAI().embeddings.create(
        model=MODEL_NAME,
        input=query.replace("\n", " "),
    )
    vector = np.asarray(response.data[0].embedding, dtype=np.float32)
    if vector.shape != (EMBEDDING_DIMENSIONS,):
        raise ValueError(
            f"Expected a {EMBEDDING_DIMENSIONS}-dimensional query embedding; "
            f"received shape {vector.shape}."
        )
    return vector / max(float(np.linalg.norm(vector)), 1e-12)


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


def filter_jobs(
    query: str,
    user_blockers: list[str] | None = None,
    jobs_path: str = JOBS_PATH,
    emb_path: str = EMBEDDINGS_PATH,
    ids_path: str = IDS_PATH,
    barriers_path: str = BARRIERS_PATH,
    barrier_emb_path: str = BARRIER_EMBEDDINGS_PATH,
    modality_emb_path: str = MODALITY_EMBEDDINGS_PATH,
    company_db_path: str = COMPANY_INCLUSION_DB,
    qualified_db_path: str = QUALIFIED_COMPANIES_DB,
    similarity_std_multiplier: float = SIMILARITY_THRESHOLD,
    blocked_threshold: float = BLOCKED_THRESHOLD,
    exclude_known_non_inclusive: bool = EXCLUDE_KNOWN_NON_INCLUSIVE,
) -> dict[str, Any]:
    """Return JSON-ready results for a search query and quiz-selected barriers.

    `user_blockers` contains selected catalog IDs such as
    `autism_spectrum:sensory_load`. `jobs` contains unblocked results, while
    `blocked_jobs` contains matching jobs flagged by the selected barriers.
    Work-modality intent is inferred from the query and only filters results
    when the query clearly requests remote, on-site, or hybrid work.
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
    company_keys = jobs["company"].map(normalize_company)
    exclusion_mask = company_keys.isin(non_inclusive_keys)
    if exclude_known_non_inclusive:
        excluded_jobs = int(exclusion_mask.sum())
        excluded_companies = int(company_keys.loc[exclusion_mask].nunique())
        jobs = jobs.loc[~exclusion_mask].copy()

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
    modality_vectors = load_modality_embeddings(modality_emb_path)
    query_vector = embed_query(query)
    requested_modalities = infer_query_modalities(cosine_scores(query_vector, modality_vectors))
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
    modality_excluded_matches = 0

    for row, document_vector, score in scored_jobs:
        if similarity_cutoff is None or score <= similarity_cutoff:
            continue
        classification = classify_job_modality(
            str(row.get("modality", "") or ""),
            cosine_scores(document_vector, modality_vectors),
        )
        if not modality_matches(requested_modalities, classification):
            modality_excluded_matches += 1
            continue
        similarity_match_count += 1
        block_reasons = []
        for barrier_id, barrier_vector, barrier in selected_barriers:
            barrier_score = float(np.dot(barrier_vector, document_vector))
            if barrier_score > blocked_threshold:
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

        job_data = json.loads(row.to_json(force_ascii=False, date_format="iso"))
        job_data["similarity"] = score
        job_data["similarity_rank"] = similarity_match_count
        job_data["blocked"] = bool(block_reasons)
        job_data["block_reasons"] = block_reasons
        job_data["modality_classification"] = classification
        company_key = normalize_company(job_data.get("company", ""))
        job_data["company_verified"] = company_key in verified_company_keys
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
        "input_jobs": input_jobs_count,
        "jobs_excluded_by_company": excluded_jobs,
        "companies_excluded": excluded_companies,
        "jobs_scored": len(scores),
        "similarity_matches": similarity_match_count,
        "requested_modalities": sorted(requested_modalities),
        "modality_filter_applied": bool(requested_modalities),
        "modality_excluded_matches": modality_excluded_matches,
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
    parser.add_argument("--jobs", default=JOBS_PATH)
    parser.add_argument("--barriers", default=BARRIERS_PATH)
    parser.add_argument("--emb", default=EMBEDDINGS_PATH)
    parser.add_argument("--ids", default=IDS_PATH)
    parser.add_argument("--barrier-emb", default=BARRIER_EMBEDDINGS_PATH)
    parser.add_argument("--modality-emb", default=MODALITY_EMBEDDINGS_PATH)
    parser.add_argument("--company-db", default=COMPANY_INCLUSION_DB)
    parser.add_argument("--qualified-db", default=QUALIFIED_COMPANIES_DB)
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

    print(f"Reading jobs JSON: {args.jobs}")
    result = filter_jobs(
        query=args.query,
        user_blockers=args.blocker,
        jobs_path=args.jobs,
        barriers_path=args.barriers,
        emb_path=args.emb,
        ids_path=args.ids,
        barrier_emb_path=args.barrier_emb,
        modality_emb_path=args.modality_emb,
        company_db_path=args.company_db,
        qualified_db_path=args.qualified_db,
        similarity_std_multiplier=args.threshold,
        blocked_threshold=args.blocked_threshold,
    )

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
