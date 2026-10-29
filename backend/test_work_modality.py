import io
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace

from pretokenize_openai import ensure_modality_embeddings
from work_modality import (
    MODALITY_IDS,
    classify_job_modality,
    infer_query_modalities,
    modality_matches,
)


class WorkModalityTests(unittest.TestCase):
    def test_query_intent_keeps_only_confident_modality_matches(self):
        self.assertEqual(
            infer_query_modalities({"remote": 0.48, "on_site": 0.12, "hybrid": 0.15}),
            {"remote"},
        )
        self.assertEqual(
            infer_query_modalities({"remote": 0.18, "on_site": 0.16, "hybrid": 0.17}),
            set(),
        )

    def test_query_intent_ignores_close_secondary_modes(self):
        self.assertEqual(
            infer_query_modalities({"remote": 0.45, "on_site": 0.30, "hybrid": 0.43}),
            {"remote"},
        )

    def test_hybrid_intent_includes_hybrid_and_remote(self):
        self.assertTrue(modality_matches({"hybrid"}, "hybrid"))
        self.assertTrue(modality_matches({"hybrid"}, "remote"))
        self.assertFalse(modality_matches({"hybrid"}, "on_site"))

    def test_remote_intent_does_not_include_unknown_or_on_site(self):
        self.assertTrue(modality_matches({"remote"}, "remote"))
        self.assertFalse(modality_matches({"remote"}, "unknown"))
        self.assertFalse(modality_matches({"remote"}, "on_site"))

    def test_on_site_intent_includes_unknown_but_not_confident_remote(self):
        self.assertTrue(modality_matches({"on_site"}, "on_site"))
        self.assertTrue(modality_matches({"on_site"}, "unknown"))
        self.assertFalse(modality_matches({"on_site"}, "remote"))
        self.assertFalse(modality_matches({"on_site"}, "hybrid"))

    def test_unlabelled_jobs_use_the_confirmed_point_five_remote_threshold(self):
        self.assertEqual(
            classify_job_modality("", {"remote": 0.50, "on_site": 0.1, "hybrid": 0.2}),
            "remote_inferred",
        )
        self.assertEqual(
            classify_job_modality("", {"remote": 0.49, "on_site": 0.1, "hybrid": 0.2}),
            "unknown",
        )

    def test_job_inference_distinguishes_hybrid_and_on_site(self):
        self.assertEqual(
            classify_job_modality("", {"remote": 0.30, "on_site": 0.20, "hybrid": 0.55}),
            "hybrid_inferred",
        )
        self.assertEqual(
            classify_job_modality("", {"remote": 0.20, "on_site": 0.52, "hybrid": 0.30}),
            "on_site_inferred",
        )

    def test_explicit_json_modality_wins_over_embedding_scores(self):
        self.assertEqual(
            classify_job_modality("remote", {"remote": 0.1, "on_site": 0.8, "hybrid": 0.1}),
            "remote",
        )
        self.assertEqual(
            classify_job_modality("on-site", {"remote": 0.8, "on_site": 0.1, "hybrid": 0.1}),
            "on_site",
        )

    def test_modality_prototypes_are_precomputed_once_and_reused(self):
        class FakeClient:
            def __init__(self):
                self.calls = 0
                self.embeddings = self

            def create(self, model, input):
                self.calls += 1
                return SimpleNamespace(
                    data=[
                        SimpleNamespace(index=i, embedding=[float(i == j) for j in range(1536)])
                        for i, _ in enumerate(input)
                    ]
                )

        client = FakeClient()
        with tempfile.TemporaryDirectory() as directory, redirect_stdout(io.StringIO()):
            path = str(Path(directory) / "modality.npz")
            first = ensure_modality_embeddings(client, path, batch_size=3)
            second = ensure_modality_embeddings(client, path, batch_size=3)

        self.assertEqual(client.calls, 1)
        self.assertEqual(first.shape, (len(MODALITY_IDS), 1536))
        self.assertEqual(second.shape, first.shape)


if __name__ == "__main__":
    unittest.main()
