import importlib.util
import json
import unittest
from pathlib import Path


PARSER_PATH = Path(__file__).parent / "resume_parser.py" / "resume_parser.py"


def load_parser():
    spec = importlib.util.spec_from_file_location("resume_parser_module", PARSER_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class ResumeParserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.parser = load_parser()

    def test_extracts_the_agreed_profile_shape(self):
        profile = self.parser.extract_information(
            "Alex Rivera\n"
            "jesus@example.com\n"
            "443-549-7878\n"
            "EXPERIENCE\n"
            "Data Analyst — 2025 - Present\n"
            "Built Python data pipelines\n"
            "PROJECTS\n"
            "Market data pipeline\n"
        )

        self.assertEqual(
            set(profile),
            {"name", "email", "phone", "skills_found", "projects", "experience", "sectors"},
        )
        self.assertEqual(profile["email"], "jesus@example.com")
        self.assertEqual(profile["phone"], "443-549-7878")
        self.assertTrue(profile["experience"])
        self.assertIsInstance(profile["skills_found"], list)
        self.assertIsInstance(profile["sectors"], list)

    def test_empty_text_returns_an_empty_profile(self):
        self.assertEqual(self.parser.parse_resume_text(""), {})

    def test_taxonomy_file_is_valid_json(self):
        taxonomy_path = PARSER_PATH.with_name("resume_taxonomy.json")
        taxonomy = json.loads(taxonomy_path.read_text(encoding="utf-8"))
        self.assertIsInstance(taxonomy["sectors"], dict)
        self.assertTrue(taxonomy["experience_headings"])


if __name__ == "__main__":
    unittest.main()
