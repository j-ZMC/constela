import io
import json
import sys
import unittest
from contextlib import redirect_stderr
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import jobs_api


class JobsApiTests(unittest.TestCase):
    def test_forwards_query_and_selected_blockers(self):
        expected = {"jobs": [], "blocked_jobs": [], "summary": {"visible_matches": 0}}
        with patch("jobs_api.filter_jobs", return_value=expected) as filter_jobs:
            result = jobs_api.search({"query": "remote analyst", "userBlockers": ["adhd:distraction_and_interruptions"]})

        self.assertEqual(result, expected)
        filter_jobs.assert_called_once_with(
            query="remote analyst",
            user_blockers=["adhd:distraction_and_interruptions"],
        )

    def test_rejects_invalid_request_shape(self):
        with patch("jobs_api.filter_jobs") as filter_jobs:
            result = jobs_api.search({"query": "", "userBlockers": "not-a-list"})

        self.assertEqual(result, {"error": "invalid_input"})
        filter_jobs.assert_not_called()

    def test_hides_internal_errors(self):
        with patch("jobs_api.filter_jobs", side_effect=RuntimeError("private traceback")):
            with redirect_stderr(io.StringIO()):
                result = jobs_api.search({"query": "remote analyst", "userBlockers": []})

        self.assertEqual(result, {"error": "backend_failed"})

    def test_cli_reads_json_and_writes_utf8_json(self):
        request = {"query": "analista remoto", "userBlockers": []}
        expected = {"jobs": [{"title": "Analista de datos"}], "blocked_jobs": [], "summary": {}}
        with patch("jobs_api.filter_jobs", return_value=expected):
            with patch.object(sys, "stdin") as stdin, patch.object(sys, "stdout") as stdout:
                stdin.read.return_value = json.dumps(request, ensure_ascii=False)
                self.assertEqual(jobs_api.main(), 0)
                stdin.reconfigure.assert_called_once_with(encoding="utf-8")
                stdout.reconfigure.assert_called_once_with(encoding="utf-8")
                stdout.write.assert_called_once_with(json.dumps(expected, ensure_ascii=False, allow_nan=False))


if __name__ == "__main__":
    unittest.main()
