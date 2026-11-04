import json
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

PARSER_DIR = Path(__file__).parent / "resume_parser"
sys.path.insert(0, str(PARSER_DIR))

import resume_parser


def make_pdf(text: str) -> bytes:
    if text:
        lines = [line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") for line in text.splitlines()]
        text_operations = b") Tj T* (".join(line.encode("ascii") for line in lines)
        content = b"BT /F1 12 Tf 14 TL 72 720 Td (" + text_operations + b") Tj ET"
    else:
        content = b"BT ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream",
    ]
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n".encode() + obj + b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode())
    pdf.extend(
        f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n".encode()
    )
    return bytes(pdf)


class ResumeParserApiTests(unittest.TestCase):
    def test_extracts_profile_from_pdf_bytes_without_saving_a_copy(self):
        with patch.object(resume_parser, "save_resume_pdf", side_effect=AssertionError):
            profile = resume_parser.parse_resume_bytes(
                make_pdf("Jane Doe\njane@example.com\nPython")
            )

        self.assertEqual(profile["name"], "Jane Doe")
        self.assertEqual(profile["email"], "jane@example.com")
        self.assertIn("Python", profile["skills_found"])

    def test_stdin_json_mode_returns_the_profile_contract(self):
        script = PARSER_DIR / "resume_parser.py"
        completed = subprocess.run(
            [sys.executable, str(script), "--stdin-json"],
            input=make_pdf("Jane Doe\njane@example.com\nPython"),
            capture_output=True,
            check=True,
        )

        self.assertEqual(json.loads(completed.stdout)["profile"]["email"], "jane@example.com")

    def test_rejects_pdfs_with_no_extractable_text(self):
        with self.assertRaisesRegex(ValueError, "No extractable text"):
            resume_parser.parse_resume_bytes(make_pdf(""))

    def test_rejects_malformed_pdf_bytes(self):
        with self.assertRaisesRegex(ValueError, "PDF could not be read"):
            resume_parser.parse_resume_bytes(b"%PDF-1.4 test")


class ReadProfileTests(unittest.TestCase):
    CV = (
        "ALEX RIVERA\n"
        "Email: alex.rivera@example.com | Phone: +52 555 010 0100\n"
        "Profile\n"
        "Data analyst who likes Python and SQL.\n"
        "Projects\n"
        "• Dashboard of city bike trips\n"
        "- Survey cleaner in Python\n"
        "Education\n"
        "University of Somewhere, 2020 - 2024\n"
    )

    def test_reads_name_contact_and_the_projects_section(self):
        profile = resume_parser.read_profile(self.CV)
        self.assertEqual(profile["name"], "Alex Rivera")
        self.assertEqual(profile["email"], "alex.rivera@example.com")
        self.assertEqual(profile["phone"], "+52 555 010 0100")
        self.assertEqual(profile["projects"], ["Dashboard of city bike trips", "Survey cleaner in Python"])
        self.assertIn("Python", profile["skills_found"])

    def test_keeps_a_name_written_in_mixed_case_and_skips_a_heading(self):
        lines = ["Curriculum Vitae", "María José de la Cruz", "maria@example.com"]
        self.assertEqual(resume_parser.find_name(lines[1:]), "María José de la Cruz")
        self.assertEqual(resume_parser.find_name(["Experience", "Ana López"]), "Ana López")

    def test_missing_fields_are_empty_not_placeholder_text(self):
        profile = resume_parser.read_profile("Notes from 2024\n123 Main Street\n")
        self.assertEqual((profile["name"], profile["email"], profile["phone"]), ("", "", ""))
        self.assertEqual(profile["sectors"], [])

    def test_a_phone_needs_10_to_15_digits(self):
        self.assertEqual(resume_parser.find_phone("Call (555) 010-0100"), "(555) 010-0100")
        self.assertEqual(resume_parser.find_phone("Years 2020 - 2024, room 12"), "")


if __name__ == "__main__":
    unittest.main()
