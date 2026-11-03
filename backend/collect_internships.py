"""Collect internships from the public job boards of inclusion-verified companies.

Step 1 (cached in data/reference/company_data/ats_boards.json; --rediscover redoes it): every company from
the inclusion sources (qualified Glassdoor/B Corp/DEI companies, B Corps in the US and Mexico, Equidad MX,
HRC) is tried as a Greenhouse, Lever and Ashby board name. These are the APIs those boards publish.
Step 2: each found board is downloaded with collect_bulk's collectors and only internships are kept, in the
shared job schema.

Usage:
  python collect_internships.py
  python pretokenize_openai.py --jobs data/raw/jobs/internships.json --emb data/processed/embeddings/internships_openai_embeddings.npy --ids data/processed/embeddings/internships_openai_ids.json
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import re
import sqlite3
import sys
import urllib.error
from pathlib import Path

import collect_bulk
from company_inclusion import (
    DEFAULT_BCORP,
    DEFAULT_DEI_MX,
    DEFAULT_DEI_US,
    REFERENCE_MIN_SCORE,
    normalize_company,
)

ROOT = Path(__file__).resolve().parent
QUALIFIED_DB = ROOT / "data/processed/qualified_company_jobs.sqlite"
BOARDS_PATH = ROOT / "data/reference/company_data/ats_boards.json"
OUT_PATH = ROOT / "data/raw/jobs/internships.json"
BCORP_COUNTRIES = {"United States", "Mexico"}
INTERNSHIP = re.compile(
    r"\b(interns?|internships?|co-?op|apprentice(ship)?s?|trainees?|practicantes?|becari[oa]s?|pr[aá]cticas)\b",
    re.IGNORECASE,
)
# Every company here passed the same reference sources as select_qualified_companies.py, but most are not in
# its database (it only lists companies that had jobs in the main file), so the jobs carry the proof themselves.
VERIFIED_TAG = "inclusion_verified"
COLLECTORS = {
    "greenhouse": collect_bulk.collect_greenhouse,
    "lever": collect_bulk.collect_lever,
    "ashby": collect_bulk.collect_ashby,
}


def candidates() -> dict[str, str]:
    """Normalized company key -> display name, from the same sources company_inclusion.py trusts."""
    found: dict[str, str] = {}
    with sqlite3.connect(QUALIFIED_DB) as db:
        found.update(db.execute("SELECT firm_clean, company FROM selected_companies").fetchall())
    for path, score in ((DEFAULT_BCORP, "bcorp_score"), (DEFAULT_DEI_MX, "dei_mx_score")):
        for row in json.loads(path.read_text(encoding="utf-8")):
            if score == "bcorp_score" and row.get("country") not in BCORP_COUNTRIES:
                continue
            if (row.get(score) or 0) >= REFERENCE_MIN_SCORE:
                found.setdefault(normalize_company(row["company"]), row["company"])
    for name in json.loads(DEFAULT_DEI_US.read_text(encoding="utf-8")).get("companies_100_hrc_2025_sample", []):
        found.setdefault(normalize_company(name), name)
    # Keys of one or two letters ("e") would match unrelated boards.
    return {key: name for key, name in found.items() if len(key) >= 3}


def get_json(url: str):
    try:
        return json.loads(collect_bulk.fetch(url))
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None
        raise


def page_title(url: str) -> str:
    """The board page's <title> ("Spotify", "Notion Jobs"); Lever and Ashby APIs do not return the name."""
    try:
        html = collect_bulk.fetch(url).decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return ""
        raise
    match = re.search(r"<title>(.*?)</title>", html, re.S | re.I)
    return re.sub(r"\s+jobs$", "", match.group(1).strip(), flags=re.I) if match else ""


def find_board(key: str, name: str) -> dict | None:
    # A board counts only when it carries the company's own name: the same slug can belong to another company.
    # That name is kept too; the inclusion sources sometimes have it in lower case ("stripe").
    words = key.split()
    for slug in dict.fromkeys(["".join(words), "-".join(words)]):
        board = get_json(f"https://boards-api.greenhouse.io/v1/boards/{slug}")
        if board and normalize_company(board.get("name")) == key:
            return {"company": board["name"].strip() or name, "ats": "greenhouse", "slug": slug}
        for ats, url in (("lever", f"https://jobs.lever.co/{slug}"), ("ashby", f"https://jobs.ashbyhq.com/{slug}")):
            title = page_title(url)
            if normalize_company(title) == key:
                return {"company": title or name, "ats": ats, "slug": slug}
    return None


def discover(companies: dict[str, str], workers: int) -> list[dict]:
    found, failed = [], 0
    with concurrent.futures.ThreadPoolExecutor(workers) as pool:
        futures = {pool.submit(find_board, key, name): name for key, name in companies.items()}
        for future in concurrent.futures.as_completed(futures):
            try:
                board = future.result()
            except Exception as exc:  # noqa: BLE001
                failed += 1
                print(f"  [{futures[future]}] could not check: {exc}", file=sys.stderr)
                continue
            if board:
                found.append(board)
                print(f"  [{board['ats']}:{board['slug']}] {board['company']}", flush=True)
    print(f"Checked {len(futures)} companies: {len(found)} boards found, {failed} could not be checked")
    return sorted(found, key=lambda board: board["company"].lower())


def internships(boards: list[dict], pause: float) -> list[dict]:
    kept = []
    for board in boards:
        jobs: list[dict] = []
        COLLECTORS[board["ats"]](10**6, pause, os.devnull, jobs, [board["slug"]])
        kept += [
            {**job, "company": board["company"], "tags": [*job["tags"], "internship", VERIFIED_TAG]}
            for job in jobs
            if INTERNSHIP.search(job["title"])
        ]
    return kept


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect internships from inclusion-verified companies")
    parser.add_argument("--rediscover", action="store_true", help="look for the companies' boards again")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--pause", type=float, default=1.0)
    parser.add_argument("--out", type=Path, default=OUT_PATH)
    args = parser.parse_args()

    if args.rediscover or not BOARDS_PATH.exists():
        boards = discover(candidates(), args.workers)
        BOARDS_PATH.write_text(json.dumps(boards, ensure_ascii=False, indent=2), encoding="utf-8")
    boards = json.loads(BOARDS_PATH.read_text(encoding="utf-8"))
    jobs = internships(boards, args.pause)
    collect_bulk.save_json(str(args.out), jobs)
    print(f"Internships: {len(jobs)} from {len({job['company'] for job in jobs})} companies -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
