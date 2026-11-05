"""Finds the flag threshold for each Job conditions option, and writes config/barrier_thresholds.json.

There are no job posts labeled by people yet, so llama3.1:8b (through Ollama, on this computer) is the judge. For each
condition:
1. Sample jobs from bands of the condition's score, more where the decision happens (0.27 to 0.42).
2. Ask the model whether the post itself shows the condition (yes or no).
3. Weight each answer by how many jobs its band holds, and keep the threshold with the best F1.
Which threshold a condition gets:
- Its best one, when there are at least MIN_YES "yes" answers and its F1 reaches MIN_F1 (the score tells yes from no).
- The highest candidate, when not one sampled job shows the condition: flags there were all false alarms.
- BLOCKED_THRESHOLD otherwise: too little evidence, or a best point that is mostly noise.

Answers are cached (data/processed/threshold_labels.json: job URL and yes/no, nothing about people), so a stopped run
picks up where it left off. Run from backend/: python tune_thresholds.py
shortcut: the judge is a model, not people; re-run against labels from people when there are some.
"""
from __future__ import annotations

import json
import os
import time
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

import filter_jobs as f

LABELS = Path("data/processed/threshold_labels.json")
REPORT = Path("data/processed/threshold_report.json")
BANDS = [0.20, 0.27, 0.30, 0.32, 0.34, 0.36, 0.38, 0.42, 1.0]
PER_BAND = [5, 10, 10, 10, 10, 10, 10, 10]
CANDIDATES = [round(t, 3) for t in np.arange(0.27, 0.425, 0.005)]
MIN_YES = 5
MIN_F1 = 0.30
MODEL = "llama3.1:8b"
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
SCHEMA = {"type": "object", "properties": {"answer": {"type": "string", "enum": ["yes", "no"]}}, "required": ["answer"]}


def ask(prompt: str) -> str:
    body = json.dumps({"model": MODEL, "prompt": prompt, "format": SCHEMA, "stream": False, "options": {"temperature": 0}})
    request = urllib.request.Request(f"{OLLAMA_URL}/api/generate", body.encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.loads(json.loads(response.read())["response"])["answer"]


def question(label: str, terms: list[str], title: str, text: str) -> str:
    return (
        "You check job posts for a job seeker who wants to know about one workplace condition.\n"
        f"Condition: {label}.\nExamples of how job posts show it: {'; '.join(terms[:10])}.\n\n"
        f"Job title: {title}\nJob post:\n{text[:2500]}\n\n"
        f"Does this job clearly involve this condition ({label})? Answer yes only if the post itself shows it. "
        "Answer yes or no."
    )


def best_threshold(scores: np.ndarray, weights: np.ndarray, yes: np.ndarray) -> tuple[float, float, float, float]:
    """(threshold, F1, precision, recall), with each sampled answer standing for `weight` jobs."""
    best = (f.BLOCKED_THRESHOLD, -1.0, 0.0, 0.0)
    for t in CANDIDATES:
        on = scores > t
        tp = float((weights * yes * on).sum())
        fp = float((weights * (1 - yes) * on).sum())
        fn = float((weights * yes * ~on).sum())
        f1 = 2 * tp / (2 * tp + fp + fn) if tp else 0.0
        if f1 > best[1]:
            best = (t, f1, tp / (tp + fp) if tp + fp else 0.0, tp / (tp + fn) if tp + fn else 0.0)
    return best


def main() -> None:
    jobs = f.clean_jobs(pd.read_json(f.JOBS_PATH)).drop_duplicates(subset="url", keep="first").reset_index(drop=True)
    job_vectors, barrier_vectors, meta = f.load_embeddings(
        jobs, f.EMBEDDINGS_PATH, f.IDS_PATH, f.BARRIER_EMBEDDINGS_PATH, f.BARRIERS_PATH
    )
    matrix = np.stack([job_vectors[str(url)] for url in jobs["url"]])
    with open(f.BARRIERS_PATH, encoding="utf-8") as file:
        catalog = json.load(file)
    terms = {f"{c['id']}:{s['id']}": s["candidate_terms_en"] for c in catalog["categories"] for s in c["subtypes"]}
    labels: dict[str, dict[str, str]] = json.loads(LABELS.read_text()) if LABELS.exists() else {}
    rng = np.random.default_rng(7)
    thresholds: dict[str, float] = {}
    report: dict[str, dict] = {}
    start = time.time()
    for n, (barrier_id, vector) in enumerate(barrier_vectors.items(), 1):
        scores = matrix @ vector
        sample: list[tuple[float, float, int]] = []  # (score, weight, job row)
        for (low, high), size in zip(zip(BANDS, BANDS[1:]), PER_BAND):
            rows = np.where((scores >= low) & (scores < high))[0]
            if len(rows):
                picked = rng.choice(rows, size=min(size, len(rows)), replace=False)
                sample += [(float(scores[r]), len(rows) / len(picked), int(r)) for r in picked]
        answers = labels.setdefault(barrier_id, {})
        for _, _, r in sample:
            url = str(jobs.at[r, "url"])
            if url not in answers:
                row = jobs.iloc[r]
                answers[url] = ask(question(meta[barrier_id]["label"], terms[barrier_id], str(row["title"]), str(row["description"])))
        LABELS.write_text(json.dumps(labels))
        yes = np.array([answers[str(jobs.at[r, "url"])] == "yes" for _, _, r in sample], dtype=float)
        threshold, f1, precision, recall = best_threshold(
            np.array([s for s, _, _ in sample]), np.array([w for _, w, _ in sample]), yes
        )
        enough = yes.sum() >= MIN_YES and f1 >= MIN_F1
        none_found = yes.sum() == 0
        thresholds[barrier_id] = threshold if enough else CANDIDATES[-1] if none_found else f.BLOCKED_THRESHOLD
        report[barrier_id] = {
            "threshold": float(thresholds[barrier_id]), "best_found": float(threshold), "enough_evidence": bool(enough),
            "none_found": bool(none_found),
            "f1": round(f1, 3), "precision": round(precision, 3), "recall": round(recall, 3),
            "yes": int(yes.sum()), "sampled": len(yes), "flagged_jobs": int((scores > thresholds[barrier_id]).sum()),
        }
        print(f"[{n}/{len(barrier_vectors)} {time.time() - start:.0f}s] {barrier_id}: {report[barrier_id]}", flush=True)
    Path(f.BARRIER_THRESHOLDS_PATH).write_text(json.dumps(thresholds, indent=2) + "\n")
    REPORT.write_text(json.dumps(report, indent=1) + "\n")
    print("DONE", flush=True)


if __name__ == "__main__":
    main()
