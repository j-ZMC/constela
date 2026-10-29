"""Export qualifying employers and all their job postings to a separate SQLite DB."""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

import pandas as pd

from company_inclusion import normalize_company

ROOT = Path(__file__).resolve().parent
DEFAULT_COMPANY_DB = ROOT / "data/processed/company_inclusion.sqlite"
DEFAULT_JOBS = ROOT / "data/raw/jobs/jobs_usa_full.json"
DEFAULT_OUTPUT_DB = ROOT / "data/processed/qualified_company_jobs.sqlite"
DEFAULT_MIN_GLASSDOOR_RATING = 3.7


def read_company_matches(database_path: Path) -> pd.DataFrame:
    with sqlite3.connect(database_path) as connection:
        companies = pd.read_sql_query("SELECT * FROM matched_companies", connection)

    required_columns = {
        "firm_clean",
        "glassdoor_inclusion_mean",
        "glassdoor_legacy_mean",
        "bcorp_score",
        "dei_mx_score",
        "dei_us_2025_match",
    }
    missing = required_columns.difference(companies.columns)
    if missing:
        raise ValueError(
            "matched_companies is missing required columns: "
            + ", ".join(sorted(missing))
        )
    return companies


def select_companies(
    companies: pd.DataFrame, minimum_glassdoor_rating: float
) -> pd.DataFrame:
    current_rating = pd.to_numeric(
        companies["glassdoor_inclusion_mean"], errors="coerce"
    )
    legacy_rating = pd.to_numeric(
        companies["glassdoor_legacy_mean"], errors="coerce"
    )
    glassdoor_current_match = current_rating.ge(minimum_glassdoor_rating)
    glassdoor_legacy_match = legacy_rating.ge(minimum_glassdoor_rating)
    other_source_match = (
        companies["bcorp_score"].notna()
        | companies["dei_mx_score"].notna()
        | pd.to_numeric(companies["dei_us_2025_match"], errors="coerce")
        .fillna(0)
        .eq(1)
    )

    selected = companies[
        glassdoor_current_match | glassdoor_legacy_match | other_source_match
    ].copy()
    selected["selection_reason"] = [
        json.dumps(
            [
                reason
                for matched, reason in (
                    (
                        bool(glassdoor_current_match.loc[index]),
                        f"glassdoor_current_at_least_{minimum_glassdoor_rating}",
                    ),
                    (
                        bool(glassdoor_legacy_match.loc[index]),
                        f"glassdoor_legacy_at_least_{minimum_glassdoor_rating}",
                    ),
                    (
                        bool(other_source_match.loc[index]),
                        "matched_non_glassdoor_source",
                    ),
                )
                if matched
            ]
        )
        for index in selected.index
    ]
    return selected


def make_sqlite_compatible(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    for column, dtype in result.dtypes.items():
        if not (
            pd.api.types.is_object_dtype(dtype)
            or pd.api.types.is_string_dtype(dtype)
        ):
            continue
        result[column] = result[column].map(
            lambda value: json.dumps(value, ensure_ascii=False)
            if isinstance(value, (dict, list))
            else None
            if pd.isna(value)
            else value
        )
    return result


def load_related_jobs(jobs_path: Path, selected_companies: pd.DataFrame) -> pd.DataFrame:
    jobs = pd.read_json(jobs_path)
    if "company" not in jobs.columns:
        raise ValueError("Job data is missing the required 'company' column")

    jobs["selected_company_key"] = jobs["company"].map(normalize_company)
    selected_keys = set(selected_companies["firm_clean"])
    related_jobs = jobs[jobs["selected_company_key"].isin(selected_keys)].copy()
    return make_sqlite_compatible(related_jobs)


def write_output_database(
    output_path: Path, selected_companies: pd.DataFrame, related_jobs: pd.DataFrame
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    companies_for_sql = make_sqlite_compatible(selected_companies)
    with sqlite3.connect(output_path) as connection:
        companies_for_sql.to_sql(
            "selected_companies", connection, if_exists="replace", index=False
        )
        related_jobs.to_sql("related_jobs", connection, if_exists="replace", index=False)
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_related_jobs_company "
            "ON related_jobs(selected_company_key)"
        )


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Select employers with a Glassdoor rating >= 3.7 in either dataset, "
            "or any non-Glassdoor company match, and export their jobs."
        )
    )
    parser.add_argument("--company-db", type=Path, default=DEFAULT_COMPANY_DB)
    parser.add_argument("--jobs", type=Path, default=DEFAULT_JOBS)
    parser.add_argument("--output-db", type=Path, default=DEFAULT_OUTPUT_DB)
    parser.add_argument(
        "--min-glassdoor-rating",
        type=float,
        default=DEFAULT_MIN_GLASSDOOR_RATING,
    )
    args = parser.parse_args()

    company_matches = read_company_matches(args.company_db)
    selected_companies = select_companies(
        company_matches, args.min_glassdoor_rating
    )
    related_jobs = load_related_jobs(args.jobs, selected_companies)
    write_output_database(args.output_db, selected_companies, related_jobs)

    print(f"Selected companies: {len(selected_companies)}")
    print(f"Related job postings: {len(related_jobs)}")
    print(f"Output database: {args.output_db}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
