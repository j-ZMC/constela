"""Precompute job and user-selectable barrier embeddings with Qwen3-Embedding-0.6B on Ollama.

Needs Ollama running (OLLAMA_URL, default http://127.0.0.1:11434) and `ollama pull qwen3-embedding:0.6b`.
The file keeps its old name so the commands and imports elsewhere keep working.

Usage:
  python pretokenize_openai.py
  python pretokenize_openai.py --rebuild
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

from collect_bulk import clean_html

MODEL_NAME = "qwen3-embedding:0.6b"
EMBEDDING_DIMENSIONS = 1024
# Qwen3-Embedding reads a search and a workplace condition better with a one-line task in front; postings go in plain.
QUERY_TASK = "Given a job search, retrieve job postings that match it"
BARRIER_TASK = "Given a workplace condition, retrieve job postings that involve it"

# Controls: edit these defaults, or override them with command-line options.
JOBS_PATH = "data/raw/jobs/jobs_usa_full_backup_cleaned.json"
BARRIERS_PATH = "config/neurodivergence_job_barriers.json"
EMBEDDINGS_PATH = (
    "data/processed/embeddings/usa_full_backup_cleaned_qwen3_embeddings.npy"
)
IDS_PATH = "data/processed/embeddings/usa_full_backup_cleaned_qwen3_ids.json"
BARRIER_EMBEDDINGS_PATH = (
    "data/processed/embeddings/neurodivergence_barriers_qwen3.npz"
)
BATCH_SIZE = 32
REBUILD_CACHE = False

def load_barrier_catalog(path: str = BARRIERS_PATH) -> list[dict[str, str]]:
    """Flatten the user-controlled JSON barrier catalog into stable subtype IDs."""
    with open(path, encoding="utf-8") as catalog_file:
        catalog = json.load(catalog_file)

    barriers = []
    for category in catalog.get("categories", []):
        category_id = str(category.get("id", "")).strip()
        category_name = str(category.get("name_en", category_id)).strip()
        for subtype in category.get("subtypes", []):
            subtype_id = str(subtype.get("id", "")).strip()
            label = str(subtype.get("label_en", subtype_id)).strip()
            terms = [
                str(term).strip()
                for term in subtype.get("candidate_terms_en", [])
                if str(term).strip()
            ]
            if not category_id or not subtype_id or not terms:
                continue
            barrier_id = f"{category_id}:{subtype_id}"
            barriers.append(
                {
                    "id": barrier_id,
                    "category_id": category_id,
                    "category_name": category_name,
                    "subtype_id": subtype_id,
                    "label": label,
                    "text": f"{label}. Potential job barriers: {', '.join(terms)}",
                }
            )

    if not barriers:
        raise ValueError(f"No barrier subtypes with candidate terms found in {path}.")
    barrier_ids = [barrier["id"] for barrier in barriers]
    if len(set(barrier_ids)) != len(barrier_ids):
        raise ValueError(f"Barrier IDs must be unique in {path}.")
    return barriers


def expected_barriers(
    path: str = BARRIERS_PATH,
) -> tuple[list[str], list[str], list[str]]:
    barriers = load_barrier_catalog(path)
    barrier_ids = [barrier["id"] for barrier in barriers]
    barrier_texts = [barrier["text"] for barrier in barriers]
    barrier_metadata = [
        json.dumps(barrier, ensure_ascii=False, sort_keys=True) for barrier in barriers
    ]
    return barrier_ids, barrier_texts, barrier_metadata


def clean_jobs(jobs: pd.DataFrame) -> pd.DataFrame:
    required = {"url", "description"}
    missing = required.difference(jobs.columns)
    if missing:
        raise ValueError(
            f"Jobs file is missing required columns: {', '.join(sorted(missing))}"
        )

    jobs = jobs.copy()
    jobs["description"] = jobs["description"].map(
        lambda value: clean_html(value) if isinstance(value, str) else ""
    )
    empty = jobs["description"].str.strip().eq("")
    if empty.any():
        # stderr: filter_jobs_openai.py --json shares this, and its stdout must be only the JSON result.
        if "source" in jobs.columns:
            print(f"Skipping {int(empty.sum())} jobs with empty descriptions:", file=sys.stderr)
            print(jobs.loc[empty].groupby("source").size().to_string(), file=sys.stderr)
        else:
            print(f"Skipping {int(empty.sum())} jobs with empty descriptions.", file=sys.stderr)
        jobs = jobs.loc[~empty].copy()
    return jobs.drop_duplicates(subset="url", keep="first")


def with_task(task: str, text: str) -> str:
    return f"Instruct: {task}\nQuery: {text}"


def ollama_embed(texts: list[str]) -> list[list[float]]:
    """One /api/embed call; Ollama keeps the model loaded for 30 minutes so the next search is quick."""
    url = os.environ.get("OLLAMA_URL") or "http://127.0.0.1:11434"
    # num_ctx: Ollama's default for this model is 32,768 tokens (4.6 GB of VRAM), too much next to llama3.1:8b on an
    # 8 GB GPU. Descriptions are cut at 4,000 characters (about 1,000 tokens); longer text is truncated the same way
    # for the cache and for each search, so the vectors stay comparable.
    body = json.dumps(
        {"model": MODEL_NAME, "input": texts, "keep_alive": "30m", "truncate": True, "options": {"num_ctx": 2048}}
    ).encode("utf-8")
    request = urllib.request.Request(f"{url}/api/embed", data=body, headers={"content-type": "application/json"})
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.load(response)["embeddings"]


def encode_texts(texts: list[str], batch_size: int) -> np.ndarray:
    if batch_size < 1 or batch_size > 2048:
        raise ValueError("--batch-size must be between 1 and 2048.")

    vectors: list[list[float]] = []
    for start in range(0, len(texts), batch_size):
        batch = [text.replace("\n", " ") for text in texts[start : start + batch_size]]
        vectors.extend(ollama_embed(batch))
        completed = min(start + len(batch), len(texts))
        print(f"  {completed}/{len(texts)}", flush=True)

    if not vectors:
        return np.zeros((0, EMBEDDING_DIMENSIONS), dtype=np.float32)
    embeddings = np.asarray(vectors, dtype=np.float32)
    if embeddings.ndim != 2 or embeddings.shape[1] != EMBEDDING_DIMENSIONS:
        raise ValueError(
            f"Expected {EMBEDDING_DIMENSIONS}-dimensional vectors from {MODEL_NAME}; "
            f"received shape {embeddings.shape}."
        )
    return embeddings


def save_job_cache(
    embeddings: np.ndarray, ids: list[str], emb_path: str, ids_path: str
) -> None:
    Path(emb_path).parent.mkdir(parents=True, exist_ok=True)
    Path(ids_path).parent.mkdir(parents=True, exist_ok=True)
    np.save(emb_path, embeddings)
    with open(ids_path, "w", encoding="utf-8") as cache_file:
        json.dump(ids, cache_file, ensure_ascii=False)


def ensure_job_embeddings(
    jobs: pd.DataFrame,
    emb_path: str,
    ids_path: str,
    *,
    rebuild: bool = False,
    batch_size: int = BATCH_SIZE,
) -> tuple[np.ndarray, list[str]]:
    jobs = clean_jobs(jobs)
    current_ids = jobs["url"].astype(str).tolist()
    cache_exists = os.path.exists(emb_path) and os.path.exists(ids_path)

    if rebuild or not cache_exists:
        print(f"Encoding {len(jobs)} jobs with {MODEL_NAME}...")
        embeddings = encode_texts(jobs["description"].tolist(), batch_size)
        save_job_cache(embeddings, current_ids, emb_path, ids_path)
        print("Job embeddings saved.")
        return embeddings, current_ids

    embeddings = np.load(emb_path)
    with open(ids_path, encoding="utf-8") as cache_file:
        saved_ids = [str(value) for value in json.load(cache_file)]
    if (
        embeddings.ndim != 2
        or embeddings.shape[1] != EMBEDDING_DIMENSIONS
        or embeddings.shape[0] != len(saved_ids)
    ):
        raise ValueError(
            f"The job embedding cache does not match {MODEL_NAME}. "
            "Use separate --emb/--ids paths or pass --rebuild."
        )

    saved_id_set = set(saved_ids)
    new_jobs = jobs.loc[~jobs["url"].astype(str).isin(saved_id_set)]
    if not new_jobs.empty:
        print(f"Encoding {len(new_jobs)} new jobs with {MODEL_NAME}...")
        new_embeddings = encode_texts(new_jobs["description"].tolist(), batch_size)
        embeddings = np.concatenate((embeddings, new_embeddings), axis=0)
        saved_ids.extend(new_jobs["url"].astype(str).tolist())
        save_job_cache(embeddings, saved_ids, emb_path, ids_path)
        print("Job embeddings saved.")
    else:
        print("Job embeddings up to date.")
    return embeddings, saved_ids


def ensure_barrier_embeddings(
    barrier_embeddings_path: str,
    *,
    barriers_path: str = BARRIERS_PATH,
    rebuild: bool = False,
    batch_size: int = BATCH_SIZE,
) -> np.ndarray:
    barrier_ids, barrier_texts, barrier_metadata = expected_barriers(barriers_path)
    if not rebuild and os.path.exists(barrier_embeddings_path):
        try:
            with np.load(barrier_embeddings_path, allow_pickle=False) as cache:
                saved_ids = cache["ids"].astype(str).tolist()
                saved_texts = cache["texts"].astype(str).tolist()
                saved_metadata = cache["metadata"].astype(str).tolist()
                embeddings = cache["embeddings"]
        except (KeyError, OSError, ValueError):
            saved_ids, saved_texts, saved_metadata, embeddings = [], [], [], np.empty((0, 0))
        if (
            saved_ids == barrier_ids
            and saved_texts == barrier_texts
            and saved_metadata == barrier_metadata
            and embeddings.shape == (len(barrier_ids), EMBEDDING_DIMENSIONS)
        ):
            print("Quiz barrier embeddings up to date.")
            return embeddings

    print(f"Encoding {len(barrier_ids)} quiz barrier subtypes...")
    embeddings = encode_texts([with_task(BARRIER_TASK, text) for text in barrier_texts], batch_size)
    Path(barrier_embeddings_path).parent.mkdir(parents=True, exist_ok=True)
    np.savez(
        barrier_embeddings_path,
        ids=np.asarray(barrier_ids, dtype=str),
        texts=np.asarray(barrier_texts, dtype=str),
        metadata=np.asarray(barrier_metadata, dtype=str),
        embeddings=embeddings,
    )
    print("Quiz barrier embeddings saved.")
    return embeddings


def main() -> int:
    parser = argparse.ArgumentParser(
        description=f"Precompute job and quiz-barrier embeddings with {MODEL_NAME}"
    )
    parser.add_argument("--jobs", default=JOBS_PATH)
    parser.add_argument("--barriers", default=BARRIERS_PATH)
    parser.add_argument("--emb", default=EMBEDDINGS_PATH)
    parser.add_argument("--ids", default=IDS_PATH)
    parser.add_argument("--barrier-emb", default=BARRIER_EMBEDDINGS_PATH)
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--rebuild", action="store_true", default=REBUILD_CACHE)
    args = parser.parse_args()

    if not 1 <= args.batch_size <= 2048:
        parser.error("--batch-size must be between 1 and 2048")

    print(f"Reading jobs JSON: {args.jobs}")
    jobs = clean_jobs(pd.read_json(args.jobs))
    ensure_job_embeddings(
        jobs,
        args.emb,
        args.ids,
        rebuild=args.rebuild,
        batch_size=args.batch_size,
    )
    ensure_barrier_embeddings(
        args.barrier_emb,
        barriers_path=args.barriers,
        rebuild=args.rebuild,
        batch_size=args.batch_size,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
