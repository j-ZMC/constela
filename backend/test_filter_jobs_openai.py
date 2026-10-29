import unittest
from unittest.mock import patch

import numpy as np
import pandas as pd

import filter_jobs_openai as jobs_filter


class FilterJobModalityTests(unittest.TestCase):
    def setUp(self):
        self.jobs = pd.DataFrame(
            [
                {"url": "remote", "title": "Remote analyst", "company": "A", "description": "Remote work", "location": "US", "modality": "remote", "salary_min": None, "salary_max": None, "currency": "", "date": "2026-01-01", "source": "test", "tags": []},
                {"url": "onsite", "title": "Office analyst", "company": "B", "description": "Office work", "location": "US", "modality": "on-site", "salary_min": None, "salary_max": None, "currency": "", "date": "2026-01-01", "source": "test", "tags": []},
                {"url": "unknown", "title": "Unspecified analyst", "company": "C", "description": "Analyst work", "location": "US", "modality": "", "salary_min": None, "salary_max": None, "currency": "", "date": "2026-01-01", "source": "test", "tags": []},
            ]
        )
        self.vectors = {
            "remote": np.array([1.0, 0.0], dtype=np.float32),
            "onsite": np.array([0.99, 0.1], dtype=np.float32),
            "unknown": np.array([0.99, -0.1], dtype=np.float32),
        }

    def search(self, query):
        with (
            patch.object(jobs_filter.pd, "read_json", return_value=self.jobs),
            patch.object(jobs_filter, "load_company_verification_sets", return_value=(set(), set())),
            patch.object(
                jobs_filter,
                "load_embeddings",
                return_value=(self.vectors, {}, {}),
            ),
            patch.object(
                jobs_filter,
                "load_modality_embeddings",
                return_value={"remote": np.array([1.0, 0.0]), "on_site": np.array([0.0, 1.0]), "hybrid": np.array([-1.0, 0.0])},
            ),
            patch.object(jobs_filter, "embed_query", return_value=np.array([1.0, 0.0])),
        ):
            return jobs_filter.filter_jobs(query=query, similarity_std_multiplier=-2)

    def test_remote_query_keeps_explicit_and_high_confidence_remote_only(self):
        result = self.search("remote analyst")
        self.assertEqual({job["url"] for job in result["jobs"]}, {"remote", "unknown"})
        self.assertEqual(result["summary"]["requested_modalities"], ["remote"])
        self.assertEqual(result["summary"]["modality_excluded_matches"], 1)
        self.assertEqual(
            next(job for job in result["jobs"] if job["url"] == "unknown")["modality_classification"],
            "remote_inferred",
        )

    def test_unqualified_query_keeps_existing_modality_behavior(self):
        with patch.object(jobs_filter, "infer_query_modalities", return_value=set()):
            result = self.search("analyst")
        self.assertEqual(len(result["jobs"]), 3)
        self.assertFalse(result["summary"]["modality_filter_applied"])


if __name__ == "__main__":
    unittest.main()
