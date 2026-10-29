"""Pre-tokenize and encode all job descriptions once.

Saves embeddings + URL index to disk. Later runs only encode new jobs.
filter_jobs.py calls ensure_embeddings() and never re-encodes everything.

Usage:
  python pretokenize.py --jobs data/raw/jobs/jobs_usa.json
  python pretokenize.py --jobs data/raw/jobs/jobs_usa.json --rebuild
"""
from __future__ import annotations

import argparse
import os

import numpy as np
import pandas as pd
import torch
from sentence_transformers import SentenceTransformer

from collect_bulk import clean_html

MODEL_NAME = "Qwen/Qwen3-Embedding-0.6B"


def load_model() -> SentenceTransformer:
    model = SentenceTransformer(
        MODEL_NAME,
        device="cuda",
        model_kwargs={"torch_dtype": torch.float32},
    )
    print(model.device)
    print(torch.cuda.get_device_name(0))
    print(f"VRAM used: {torch.cuda.memory_allocated(0) / 1e9:.2f} GB")
    return model


def encode_chunks(model: SentenceTransformer, texts: list[str]) -> np.ndarray:
    parts = []
    for k, text in enumerate(texts, 1):
        parts.append(np.asarray(model.encode([text], show_progress_bar=False)))
        if k % 50 == 0 or k == len(texts):
            print(f"  {k}/{len(texts)}", flush=True)
    return np.concatenate(parts) if parts else np.zeros((0, 1024), dtype=np.float32)


def ensure_embeddings(model: SentenceTransformer, jobs: pd.DataFrame,
                      emb_path: str, ids_path: str,
                      rebuild: bool = False) -> tuple[np.ndarray, list[str]]:
    jobs = jobs.copy()
    jobs["description"] = jobs["description"].map(
        lambda value: clean_html(value) if isinstance(value, str) else ""
    )
    empty_descriptions = jobs["description"].str.strip().eq("")
    if empty_descriptions.any():
        print(f"Skipping {int(empty_descriptions.sum())} jobs with empty descriptions.")
        jobs = jobs.loc[~empty_descriptions].copy()

    if rebuild or not (os.path.exists(emb_path) and os.path.exists(ids_path)):
        print(f"Encoding {len(jobs)} jobs from scratch...")
        all_embs = encode_chunks(model, jobs["description"].tolist())
        saved_ids = jobs["url"].tolist()
        np.save(emb_path, np.asarray(all_embs))
        pd.Series(saved_ids).to_json(ids_path)
        print("Embeddings saved.")
        return np.asarray(all_embs), saved_ids

    all_embs = np.load(emb_path)
    saved_ids = pd.read_json(ids_path, typ="series").tolist()
    mask = ~jobs["url"].isin(set(saved_ids))
    new_rows = jobs[mask]
    if len(new_rows):
        print(f"Encoding {len(new_rows)} new jobs...")
        new_embs = encode_chunks(model, new_rows["description"].tolist())
        all_embs = np.concatenate([all_embs, np.asarray(new_embs)])
        saved_ids = saved_ids + new_rows["url"].tolist()
        np.save(emb_path, all_embs)
        pd.Series(saved_ids).to_json(ids_path)
        print("Embeddings saved.")
    else:
        print("Embeddings up to date.")
    return np.asarray(all_embs), saved_ids


def main() -> int:
    parser = argparse.ArgumentParser(description="Pre-tokenize job descriptions")
    parser.add_argument("--jobs", default="data/raw/jobs/jobs_usa.json")
    parser.add_argument("--emb", default="data/processed/embeddings/usa_clean_embeddings.npy")
    parser.add_argument("--ids", default="data/processed/embeddings/usa_clean_ids.json")
    parser.add_argument("--rebuild", action="store_true")
    args = parser.parse_args()

    model = load_model()
    jobs = pd.read_json(args.jobs)
    ensure_embeddings(model, jobs, args.emb, args.ids, rebuild=args.rebuild)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
