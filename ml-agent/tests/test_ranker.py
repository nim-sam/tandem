"""Run with: python -m unittest discover -s tests   (from ml-agent/)"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.ranker import PreferenceLearner  # noqa: E402

PRIOR = {"duration": -3.0, "transfers": -1.5, "walk": 0.6, "nature": 0.5}
FAST = {"duration": 0.40, "transfers": 0.0, "walk": 0.2, "nature": 0.0}  # 24 min, direct
GREEN = {"duration": 0.55, "transfers": 0.0, "walk": 0.9, "nature": 0.7}  # 33 min walk through a park


class PreferenceLearnerTest(unittest.TestCase):
    def test_cold_start_equals_prior(self):
        learner = PreferenceLearner()
        scores = learner.rank("u", PRIOR, {"fast": FAST, "green": GREEN})
        self.assertAlmostEqual(scores["fast"], sum(PRIOR[k] * FAST[k] for k in PRIOR))
        self.assertEqual(learner.feedback_count("u"), 0)

    def test_learns_from_choices_and_is_per_user(self):
        learner = PreferenceLearner()
        prior = dict(PRIOR, walk=0.0, nature=0.0)  # settings alone prefer the fast route
        before = learner.rank("u", prior, {"fast": FAST, "green": GREEN})
        self.assertGreater(before["fast"], before["green"])

        for _ in range(3):
            learner.learn("u", prior, chosen=GREEN, rejected=[FAST])

        after = learner.rank("u", prior, {"fast": FAST, "green": GREEN})
        self.assertGreater(after["green"], after["fast"])
        self.assertGreater(learner.delta("u")["nature"], 0)
        other = learner.rank("someone-else", prior, {"fast": FAST, "green": GREEN})
        self.assertGreater(other["fast"], other["green"])

    def test_persists_to_disk(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "w.json"
            PreferenceLearner(path).learn("u", PRIOR, chosen=GREEN, rejected=[FAST])
            reloaded = PreferenceLearner(path)
            self.assertEqual(reloaded.feedback_count("u"), 1)
            self.assertNotEqual(reloaded.delta("u"), {})


if __name__ == "__main__":
    unittest.main()
