"""Match job-posting companies with inclusion datasets and store matches in SQLite."""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

ROOT = Path(__file__).resolve().parent
DEFAULT_JOBS = ROOT / "data/raw/jobs/jobs_usa_full.json"
DEFAULT_GLASSDOOR_CURRENT = ROOT / "data/raw/glassdoor/current/all_reviews.csv"
DEFAULT_GLASSDOOR_LEGACY = ROOT / "data/raw/glassdoor/legacy/glassdoor_reviews.csv"
DEFAULT_BCORP = ROOT / "data/reference/company_data/bcorp.json"
DEFAULT_DEI_MX = ROOT / "data/reference/company_data/dei_mx_2025.json"
DEFAULT_DEI_US = ROOT / "data/reference/company_data/dei_us_2025.json"
DEFAULT_DB = ROOT / "data/processed/company_inclusion.sqlite"
GLASSDOOR_MIN_REVIEWS = 10
REFERENCE_MIN_SCORE = 80
CSV_CHUNK_SIZE = 500_000
SUFFIXES = re.compile(
    r"\b(inc|llc|corp|corporation|company|co|ltd|limited|technologies|technology|labs|laboratories|group|holdings|solutions|systems|services)\b",
    re.IGNORECASE,
)
GLASSDOOR_FIRM_PATTERN = re.compile(r"Reviews/(.+?)-Reviews-E\d+", re.IGNORECASE)


def normalize_company(name: Any) -> str:
    """Normalize a company name for conservative exact-key matching."""
    if not isinstance(name, str):
        return ""
    name = name.lower().strip().replace("&", " and ")
    name = re.sub(r"[^a-z0-9 ]", " ", name)
    name = SUFFIXES.sub(" ", name)
    return re.sub(r"\s+", " ", name).strip()


def load_glassdoor_scores(
    path: Path,
    firm_column: str,
    score_column: str,
    use_firm_link: bool = False,
) -> pd.DataFrame:
    """Aggregate a Glassdoor CSV in chunks and return company-level scores."""
    totals: dict[str, list[float]] = {}
    for chunk in pd.read_csv(
        path,
        usecols=[firm_column, score_column],
        low_memory=False,
        chunksize=CSV_CHUNK_SIZE,
    ):
        ratings = pd.to_numeric(chunk[score_column], errors="coerce")
        firms = chunk[firm_column].astype("string")
        if use_firm_link:
            firms = firms.str.extract(GLASSDOOR_FIRM_PATTERN, expand=False)
            firms = firms.str.replace("-", " ", regex=False)
        firms = firms.map(normalize_company)
        review_data = pd.DataFrame({"firm_clean": firms, "rating": ratings}).dropna(
            subset=["rating"]
        )
        review_data = review_data[review_data["firm_clean"] != ""]
        grouped = review_data.groupby("firm_clean")["rating"].agg(["sum", "count"])
        for firm, row in grouped.iterrows():
            values = totals.setdefault(firm, [0.0, 0.0])
            values[0] += float(row["sum"])
            values[1] += int(row["count"])

    rows = [
        (firm, total / count, int(count))
        for firm, (total, count) in totals.items()
        if count >= GLASSDOOR_MIN_REVIEWS
    ]
    return pd.DataFrame(rows, columns=["firm_clean", "score_mean", "reviews"])


def load_reference_scores(path: Path, score_column: str) -> pd.DataFrame:
    """Load and normalize a company-score JSON list, retaining scores of 80+."""
    with path.open(encoding="utf-8") as file:
        records = json.load(file)
    reference = pd.DataFrame(records)
    if reference.empty or "company" not in reference or score_column not in reference:
        return pd.DataFrame(columns=["firm_clean", score_column])
    reference[score_column] = pd.to_numeric(reference[score_column], errors="coerce")
    reference["firm_clean"] = reference["company"].map(normalize_company)
    reference = reference[
        (reference[score_column] >= REFERENCE_MIN_SCORE) & (reference["firm_clean"] != "")
    ]
    return reference.groupby("firm_clean", as_index=False)[score_column].max()


def load_dei_us_names(path: Path) -> pd.DataFrame:
    """Load the current interim DEI US company-name list."""
    with path.open(encoding="utf-8") as file:
        payload = json.load(file)
    names = payload.get("companies_100_hrc_2025_sample", [])
    return pd.DataFrame(
        {"firm_clean": sorted({normalize_company(name) for name in names} - {""}),
         "dei_us_2025_match": 1}
    )


def load_job_companies(path: Path) -> pd.DataFrame:
    jobs = pd.read_json(path)
    required = {"company", "title", "source"}
    missing = required.difference(jobs.columns)
    if missing:
        raise ValueError(f"Job data is missing required columns: {', '.join(sorted(missing))}")

    jobs = jobs.copy()
    jobs["firm_clean"] = jobs["company"].map(normalize_company)
    jobs = jobs[jobs["firm_clean"] != ""]
    jobs["company"] = jobs["company"].fillna("").astype(str)
    jobs["source"] = jobs["source"].fillna("").astype(str)
    companies = jobs.groupby("firm_clean", as_index=False).agg(
        company=("company", "first"),
        vacancy_count=("title", "count"),
        vacancy_sources=("source", lambda values: json.dumps(sorted(set(values) - {""}))),
    )
    return companies


def build_company_matches(
    jobs_path: Path,
    glassdoor_current_path: Path,
    glassdoor_legacy_path: Path,
    bcorp_path: Path,
    dei_mx_path: Path,
    dei_us_path: Path,
) -> pd.DataFrame:
    companies = load_job_companies(jobs_path).set_index("firm_clean")
    current_scores = load_glassdoor_scores(
        glassdoor_current_path,
        "firm_link",
        "Diversity & Inclusion",
        use_firm_link=True,
    ).rename(
        columns={
            "score_mean": "glassdoor_inclusion_mean",
            "reviews": "glassdoor_reviews",
        }
    )
    legacy_scores = load_glassdoor_scores(
        glassdoor_legacy_path, "firm", "diversity_inclusion"
    ).rename(
        columns={
            "score_mean": "glassdoor_legacy_mean",
            "reviews": "glassdoor_legacy_reviews",
        }
    )
    sources = [
        current_scores.set_index("firm_clean"),
        legacy_scores.set_index("firm_clean"),
        load_reference_scores(bcorp_path, "bcorp_score").set_index("firm_clean"),
        load_reference_scores(dei_mx_path, "dei_mx_score").set_index("firm_clean"),
        load_dei_us_names(dei_us_path).set_index("firm_clean"),
    ]
    for source in sources:
        companies = companies.join(source, how="left")

    companies["dei_us_2025_match"] = companies["dei_us_2025_match"].fillna(0).astype(int)
    source_columns = [
        "glassdoor_inclusion_mean",
        "glassdoor_legacy_mean",
        "bcorp_score",
        "dei_mx_score",
    ]
    matches = companies[
        companies[source_columns].notna().any(axis=1)
        | companies["dei_us_2025_match"].eq(1)
    ].copy()
    matches["matched_sources"] = matches.apply(
        lambda row: json.dumps(
            [
                source
                for source, is_match in (
                    ("glassdoor_current", pd.notna(row["glassdoor_inclusion_mean"])),
                    ("glassdoor_legacy", pd.notna(row["glassdoor_legacy_mean"])),
                    ("bcorp", pd.notna(row["bcorp_score"])),
                    ("dei_mx_2025", pd.notna(row["dei_mx_score"])),
                    ("dei_us_2025_sample", row["dei_us_2025_match"] == 1),
                )
                if is_match
            ]
        ),
        axis=1,
    )
    matches["refreshed_at_utc"] = datetime.now(timezone.utc).isoformat()
    return matches.reset_index()


def save_matches_sqlite(matches: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    columns = [
        "firm_clean",
        "company",
        "vacancy_count",
        "vacancy_sources",
        "glassdoor_inclusion_mean",
        "glassdoor_reviews",
        "glassdoor_legacy_mean",
        "glassdoor_legacy_reviews",
        "bcorp_score",
        "dei_mx_score",
        "dei_us_2025_match",
        "matched_sources",
        "refreshed_at_utc",
    ]
    placeholders = ", ".join("?" for _ in columns)
    with sqlite3.connect(path) as connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS matched_companies (
                firm_clean TEXT PRIMARY KEY,
                company TEXT NOT NULL,
                vacancy_count INTEGER NOT NULL,
                vacancy_sources TEXT NOT NULL,
                glassdoor_inclusion_mean REAL,
                glassdoor_reviews INTEGER,
                glassdoor_legacy_mean REAL,
                glassdoor_legacy_reviews INTEGER,
                bcorp_score REAL,
                dei_mx_score REAL,
                dei_us_2025_match INTEGER NOT NULL,
                matched_sources TEXT NOT NULL,
                refreshed_at_utc TEXT NOT NULL
            )"""
        )
        existing_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(matched_companies)")
        }
        for column, sql_type in (
            ("glassdoor_legacy_mean", "REAL"),
            ("glassdoor_legacy_reviews", "INTEGER"),
        ):
            if column not in existing_columns:
                connection.execute(
                    f"ALTER TABLE matched_companies ADD COLUMN {column} {sql_type}"
                )
        connection.execute("DELETE FROM matched_companies")
        connection.executemany(
            f"INSERT INTO matched_companies ({', '.join(columns)}) VALUES ({placeholders})",
            [
                tuple(None if pd.isna(value) else value for value in row)
                for row in matches[columns].itertuples(index=False, name=None)
            ],
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_matched_companies_name ON matched_companies(company)"
        )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Match job companies with inclusion references and save matches to SQLite."
    )
    parser.add_argument("--jobs", type=Path, default=DEFAULT_JOBS)
    parser.add_argument("--glassdoor-current", type=Path, default=DEFAULT_GLASSDOOR_CURRENT)
    parser.add_argument("--glassdoor-legacy", type=Path, default=DEFAULT_GLASSDOOR_LEGACY)
    parser.add_argument("--bcorp", type=Path, default=DEFAULT_BCORP)
    parser.add_argument("--dei-mx", type=Path, default=DEFAULT_DEI_MX)
    parser.add_argument("--dei-us", type=Path, default=DEFAULT_DEI_US)
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    args = parser.parse_args()

    matches = build_company_matches(
        args.jobs,
        args.glassdoor_current,
        args.glassdoor_legacy,
        args.bcorp,
        args.dei_mx,
        args.dei_us
    )
    save_matches_sqlite(matches, args.db)
    print(f"Matched companies saved: {len(matches)}")
    print(f"Database: {args.db}")
    if not matches.empty:
        print("Matched sources:")
        for source, count in (
            ("Glassdoor current", matches["glassdoor_inclusion_mean"].notna().sum()),
            ("Glassdoor legacy", matches["glassdoor_legacy_mean"].notna().sum()),
            ("B Corp", matches["bcorp_score"].notna().sum()),
            ("DEI MX 2025", matches["dei_mx_score"].notna().sum()),
            ("DEI US sample", matches["dei_us_2025_match"].eq(1).sum()),
        ):
            print(f"  {source}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
