import contextlib
import io
import json
import sys
import unittest
from unittest.mock import patch

import pandas as pd

import filter_jobs_openai


class JsonCliTests(unittest.TestCase):
    def test_json_mode_prints_only_the_worker_result(self):
        expected = {"jobs": [], "blocked_jobs": [], "summary": {"query": "remote analyst"}}
        output = io.StringIO()

        with (
            patch.object(
                sys,
                "argv",
                ["filter_jobs_openai.py", "--query", "remote analyst", "--json"],
            ),
            patch.object(filter_jobs_openai, "filter_jobs", return_value=expected),
            contextlib.redirect_stdout(output),
        ):
            status = filter_jobs_openai.main()

        self.assertEqual(status, 0)
        self.assertEqual(json.loads(output.getvalue()), expected)
        self.assertEqual(output.getvalue().count("\n"), 1)

    def test_custom_blockers_are_forwarded_even_when_they_start_with_a_dash(self):
        with (
            patch.object(
                sys,
                "argv",
                ["filter_jobs_openai.py", "--query", "x", "--json", "--custom-blocker=-night shift"],
            ),
            patch.object(
                filter_jobs_openai,
                "filter_jobs",
                return_value={"jobs": [], "blocked_jobs": [], "summary": {}},
            ) as filter_jobs,
            contextlib.redirect_stdout(io.StringIO()),
        ):
            filter_jobs_openai.main()

        self.assertEqual(filter_jobs.call_args.kwargs["custom_blockers"], ["-night shift"])


class CustomBlockerTests(unittest.TestCase):
    job = pd.Series(
        {"title": "Support Agent", "description": "Night shift work in an Open Office. Rotating shifts."}
    )

    def test_flags_whole_words_ignoring_case(self):
        reasons = filter_jobs_openai.custom_blocker_reasons(self.job, ["night shift", "open office"])
        self.assertEqual([reason["barrier_id"] for reason in reasons], ["custom:night shift", "custom:open office"])
        self.assertEqual(reasons[0]["label"], 'Mentions "night shift"')
        self.assertIsInstance(reasons[0]["score"], float)

    def test_does_not_match_inside_other_words_or_when_absent(self):
        self.assertEqual(filter_jobs_openai.custom_blocker_reasons(self.job, ["shift", "ice", "remote"])[0]["subtype_id"], "shift")
        self.assertEqual(len(filter_jobs_openai.custom_blocker_reasons(self.job, ["ice", "remote"])), 0)

    def test_matches_words_with_symbols(self):
        job = pd.Series({"title": "C++ Developer", "description": "Open 24/7 support."})
        reasons = filter_jobs_openai.custom_blocker_reasons(job, ["c++", "24/7"])
        self.assertEqual(len(reasons), 2)


class PayFromTextTests(unittest.TestCase):
    pay = staticmethod(filter_jobs_openai.pay_from_text)

    def test_reads_ranges_with_their_period_and_currency(self):
        self.assertEqual(
            self.pay("The pay range is $54 — $60 USD per hour."),
            {"salary_min": 54.0, "salary_max": 60.0, "currency": "USD", "salary_period": "hour"},
        )
        self.assertEqual(self.pay("Salary: $80k - $100k")["salary_max"], 100_000.0)
        self.assertEqual(self.pay("Compensation $35,000 - $65,000 a year")["salary_period"], "year")
        self.assertEqual(self.pay("Base pay $18.00 - $24.95")["salary_period"], "hour")
        self.assertEqual(self.pay("Base pay $18.00 - $24.95")["currency"], "$")
        self.assertEqual(
            self.pay("The salary is $800 USD monthly as a contractor. Pay Range $800 — $800 USD"),
            {"salary_min": 800.0, "salary_max": 800.0, "currency": "USD", "salary_period": "month"},
        )

    def test_skips_amounts_that_are_not_pay(self):
        self.assertIsNone(self.pay("We raised $50 - $100 million from investors. Pay is great."))
        self.assertIsNone(self.pay("Projects cost $2,000 - $5,000 for clients."))
        self.assertIsNone(self.pay("Salary $10 - $500,000"))
        self.assertIsNone(self.pay(""))


class WorkModeTests(unittest.TestCase):
    mode = staticmethod(lambda description="", **job: filter_jobs_openai.work_mode({"description": description, **job}))

    def test_fields_title_and_location_come_first(self):
        self.assertEqual(self.mode(modality="Remote"), "remote")
        self.assertEqual(self.mode(location="Remote, USA"), "remote")
        self.assertEqual(self.mode(title="Analyst (Hybrid)", description="fully remote"), "hybrid")

    def test_reads_the_text_when_nothing_else_says(self):
        self.assertEqual(self.mode("This is a paid, fully remote internship."), "remote_inferred")
        self.assertEqual(self.mode("Work from our NYC office on a flexible hybrid schedule."), "hybrid_inferred")
        self.assertEqual(self.mode("Location: SF HQ. Hybrid, onsite 3+ days a week."), "hybrid_inferred")
        self.assertEqual(self.mode("A minimum of 3 days per week at our office."), "hybrid_inferred")
        self.assertEqual(self.mode("This position is expected to be 100% onsite."), "on_site_inferred")

    def test_perks_and_tech_words_do_not_count(self):
        self.assertEqual(self.mode("15 days of temporary remote work flexibility per year."), "unknown")
        self.assertEqual(self.mode("Accommodations to work from home, and catered lunch."), "unknown")
        self.assertEqual(self.mode("Experience with hybrid cloud. We hold on-site interviews."), "unknown")


class CompanyPayTests(unittest.TestCase):
    def test_lists_what_other_jobs_at_the_company_pay(self):
        jobs = pd.DataFrame([
            {"title": "Intern SF", "url": "a", "salary_min": None, "salary_max": None, "currency": "", "description": "Hourly Rate $54 — $60 USD"},
            {"title": "Intern Berlin", "url": "b", "salary_min": None, "salary_max": None, "currency": "", "description": "No pay here."},
            {"title": "Engineer", "url": "c", "salary_min": 100000.0, "salary_max": 120000.0, "currency": "USD", "description": ""},
            {"title": "Other company", "url": "d", "salary_min": 1.0, "salary_max": 2.0, "currency": "USD", "description": ""},
        ])
        keys = pd.Series(["databricks", "databricks", "databricks", "acme"])
        examples = filter_jobs_openai.company_pay_examples(jobs, keys, "databricks")
        self.assertEqual([e["title"] for e in examples], ["Intern SF", "Engineer"])
        self.assertEqual(examples[0]["salary_period"], "hour")
        self.assertEqual(examples[1]["salary_max"], 120000.0)

    def test_collectors_read_pay_before_cutting_the_text(self):
        import collect_bulk

        job = collect_bulk.normalize({"description": "x " * 3000 + "The base salary range is $80,000 - $95,000 per year."})
        self.assertEqual(len(job["description"]), 4000)
        self.assertEqual((job["salary_min"], job["salary_period"]), (80000.0, "year"))


class CompanyFactsTests(unittest.TestCase):
    def test_reads_scores_and_turns_missing_ones_into_null(self):
        import sqlite3
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as folder:
            path = str(Path(folder) / "qualified.sqlite")
            row = {column: None for column in filter_jobs_openai.FACT_COLUMNS}
            row.update(firm_clean="acme", glassdoor_inclusion_mean=4.2, glassdoor_reviews=31)
            with contextlib.closing(sqlite3.connect(path)) as connection:
                pd.DataFrame([row]).to_sql("selected_companies", connection, index=False)
            facts = filter_jobs_openai.load_company_facts(path)

        self.assertEqual(facts["acme"]["glassdoor_inclusion_mean"], 4.2)
        self.assertIsNone(facts["acme"]["bcorp_score"])
        json.dumps(facts, allow_nan=False)


if __name__ == "__main__":
    unittest.main()
