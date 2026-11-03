import unittest
from unittest.mock import patch

import collect_internships


def fake_api(responses):
    return lambda url: next((data for prefix, data in responses.items() if url.startswith(prefix)), None)


class InternshipTitleTests(unittest.TestCase):
    def test_keeps_internships_and_skips_lookalikes(self):
        keep = ["Software Engineer Intern", "Summer 2027 Internship", "Co-op, Finance", "Practicante de Datos", "Becaria RH"]
        skip = ["Internal Audit Manager", "International Sales Lead", "Senior Data Analyst"]
        self.assertTrue(all(collect_internships.INTERNSHIP.search(title) for title in keep))
        self.assertFalse(any(collect_internships.INTERNSHIP.search(title) for title in skip))


class FindBoardTests(unittest.TestCase):
    def test_greenhouse_board_must_carry_the_company_name(self):
        api = {"https://boards-api.greenhouse.io/v1/boards/fourseasons": {"name": "Four Seasons"}}
        with patch.object(collect_internships, "get_json", fake_api(api)):
            board = collect_internships.find_board("four seasons", "Four Seasons Hotels")
        self.assertEqual(board, {"company": "Four Seasons", "ats": "greenhouse", "slug": "fourseasons"})

    def test_other_company_on_the_same_slug_is_not_taken(self):
        api = {"https://boards-api.greenhouse.io/v1/boards/capital": {"name": "Capital One"}}
        pages = {"https://jobs.lever.co/capital": "capital.com", "https://jobs.ashbyhq.com/capital": ""}
        with (
            patch.object(collect_internships, "get_json", fake_api(api)),
            patch.object(collect_internships, "page_title", pages.get),
        ):
            self.assertIsNone(collect_internships.find_board("capital", "CO Capital"))

    def test_lever_and_ashby_boards_count_by_their_page_title(self):
        with patch.object(collect_internships, "get_json", fake_api({})):
            with patch.object(collect_internships, "page_title", {"https://jobs.lever.co/gusto": "Gusto"}.get):
                self.assertEqual(collect_internships.find_board("gusto", "Gusto")["ats"], "lever")
            with patch.object(collect_internships, "page_title", {"https://jobs.ashbyhq.com/toms": "TOMS"}.get):
                self.assertEqual(collect_internships.find_board("toms", "TOMS")["ats"], "ashby")


if __name__ == "__main__":
    unittest.main()
