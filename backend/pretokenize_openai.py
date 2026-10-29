"""Precompute job and user-selectable barrier embeddings with OpenAI.

Requires OPENAI_API_KEY in the environment.

Usage:
  python pretokenize_openai.py
  python pretokenize_openai.py --rebuild
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from collect_bulk import clean_html
from work_modality import MODALITY_IDS, MODALITY_PROTOTYPES

MODEL_NAME = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536

# Controls: edit these defaults, or override them with command-line options.
JOBS_PATH = "data/raw/jobs/jobs_usa_full_backup_cleaned.json"
BARRIERS_PATH = "config/neurodivergence_job_barriers.json"
EMBEDDINGS_PATH = (
    "data/processed/embeddings/usa_full_backup_cleaned_openai_embeddings.npy"
)
IDS_PATH = "data/processed/embeddings/usa_full_backup_cleaned_openai_ids.json"
BARRIER_EMBEDDINGS_PATH = (
    "data/processed/embeddings/neurodivergence_barriers_openai.npz"
)
MODALITY_EMBEDDINGS_PATH = "data/processed/embeddings/workplace_modalities_openai.npz"
BATCH_SIZE = 100
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
        if "source" in jobs.columns:
            print(f"Skipping {int(empty.sum())} jobs with empty descriptions:")
            print(jobs.loc[empty].groupby("source").size().to_string())
        else:
            print(f"Skipping {int(empty.sum())} jobs with empty descriptions.")
        jobs = jobs.loc[~empty].copy()
    return jobs.drop_duplicates(subset="url", keep="first")


def encode_texts(client: Any, texts: list[str], batch_size: int) -> np.ndarray:
    if batch_size < 1 or batch_size > 2048:
        raise ValueError("--batch-size must be between 1 and 2048.")

    vectors: list[list[float]] = []
    for start in range(0, len(texts), batch_size):
        batch = [text.replace("\n", " ") for text in texts[start : start + batch_size]]
        response = client.embeddings.create(model=MODEL_NAME, input=batch)
        ordered = sorted(response.data, key=lambda item: item.index)
        vectors.extend(item.embedding for item in ordered)
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
    client: Any,
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
        embeddings = encode_texts(client, jobs["description"].tolist(), batch_size)
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
            "The job embedding cache does not match text-embedding-3-small. "
            "Use separate --emb/--ids paths or pass --rebuild."
        )

    saved_id_set = set(saved_ids)
    new_jobs = jobs.loc[~jobs["url"].astype(str).isin(saved_id_set)]
    if not new_jobs.empty:
        print(f"Encoding {len(new_jobs)} new jobs with {MODEL_NAME}...")
        new_embeddings = encode_texts(
            client, new_jobs["description"].tolist(), batch_size
        )
        embeddings = np.concatenate((embeddings, new_embeddings), axis=0)
        saved_ids.extend(new_jobs["url"].astype(str).tolist())
        save_job_cache(embeddings, saved_ids, emb_path, ids_path)
        print("Job embeddings saved.")
    else:
        print("Job embeddings up to date.")
    return embeddings, saved_ids


def ensure_barrier_embeddings(
    client: Any,
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
    embeddings = encode_texts(client, barrier_texts, batch_size)
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


def ensure_modality_embeddings(
    client: Any,
    modality_embeddings_path: str = MODALITY_EMBEDDINGS_PATH,
    *,
    rebuild: bool = False,
    batch_size: int = BATCH_SIZE,
) -> np.ndarray:
    modality_ids = list(MODALITY_IDS)
    modality_texts = [MODALITY_PROTOTYPES[key] for key in modality_ids]
    if not rebuild and os.path.exists(modality_embeddings_path):
        try:
            with np.load(modality_embeddings_path, allow_pickle=False) as cache:
                saved_ids = cache["ids"].astype(str).tolist()
                saved_texts = cache["texts"].astype(str).tolist()
                embeddings = cache["embeddings"]
        except (KeyError, OSError, ValueError):
            saved_ids, saved_texts, embeddings = [], [], np.empty((0, 0))
        if (
            saved_ids == modality_ids
            and saved_texts == modality_texts
            and embeddings.shape == (len(modality_ids), EMBEDDING_DIMENSIONS)
        ):
            print("Work-modality embeddings up to date.")
            return embeddings

    print(f"Encoding {len(modality_ids)} work-modality prototypes...")
    embeddings = encode_texts(client, modality_texts, batch_size)
    Path(modality_embeddings_path).parent.mkdir(parents=True, exist_ok=True)
    np.savez(
        modality_embeddings_path,
        ids=np.asarray(modality_ids, dtype=str),
        texts=np.asarray(modality_texts, dtype=str),
        embeddings=embeddings,
    )
    print("Work-modality embeddings saved.")
    return embeddings


def main() -> int:
    from openai import OpenAI

    parser = argparse.ArgumentParser(
        description=f"Precompute job and quiz-barrier embeddings with {MODEL_NAME}"
    )
    parser.add_argument("--jobs", default=JOBS_PATH)
    parser.add_argument("--barriers", default=BARRIERS_PATH)
    parser.add_argument("--emb", default=EMBEDDINGS_PATH)
    parser.add_argument("--ids", default=IDS_PATH)
    parser.add_argument("--barrier-emb", default=BARRIER_EMBEDDINGS_PATH)
    parser.add_argument("--modality-emb", default=MODALITY_EMBEDDINGS_PATH)
    parser.add_argument("--batch-size", type=int, default=BATCH_SIZE)
    parser.add_argument("--rebuild", action="store_true", default=REBUILD_CACHE)
    args = parser.parse_args()

    if not 1 <= args.batch_size <= 2048:
        parser.error("--batch-size must be between 1 and 2048")

    print(f"Reading jobs JSON: {args.jobs}")
    jobs = clean_jobs(pd.read_json(args.jobs))
    client = OpenAI()
    ensure_job_embeddings(
        client,
        jobs,
        args.emb,
        args.ids,
        rebuild=args.rebuild,
        batch_size=args.batch_size,
    )
    ensure_barrier_embeddings(
        client,
        args.barrier_emb,
        barriers_path=args.barriers,
        rebuild=args.rebuild,
        batch_size=args.batch_size,
    )
    ensure_modality_embeddings(
        client,
        args.modality_emb,
        rebuild=args.rebuild,
        batch_size=args.batch_size,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
