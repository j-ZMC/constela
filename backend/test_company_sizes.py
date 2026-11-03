import unittest

import company_sizes


class CompanySizeTests(unittest.TestCase):
    def test_employee_counts_and_bcorp_bands_map_to_three_sizes(self):
        self.assertEqual([company_sizes.size_of(n) for n in (1, 49, 50, 999, 1000)], ["small", "small", "medium", "medium", "large"])
        self.assertEqual(company_sizes.BCORP_BANDS["10-49"], "small")
        self.assertEqual(company_sizes.BCORP_BANDS["1000+"], "large")
        # "250+" could be medium or large, so it stays unknown.
        self.assertNotIn("250+", company_sizes.BCORP_BANDS)

    def test_reads_the_size_a_posting_states(self):
        stated = company_sizes.stated_employees
        self.assertEqual(stated("More than 11,000 employees in 21 plants."), 11000)
        self.assertEqual(stated("Kalmar employs approximately 5,200 people."), 5200)
        self.assertEqual(stated("We have 3k+ team members."), 3000)
        self.assertEqual(stated("Join a team of 40 builders."), 40)
        self.assertIsNone(stated("We help 2,000,000 people every year."))
        self.assertIsNone(stated("1 employee benefit is lunch."))


if __name__ == "__main__":
    unittest.main()
