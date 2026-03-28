import unittest

import torch

from app.ml.uncertainty import compute_uncertainty


class UncertaintyTests(unittest.TestCase):
    def test_high_confidence_not_uncertain(self):
        probs = torch.tensor([0.92, 0.04, 0.03, 0.01], dtype=torch.float32)
        result = compute_uncertainty(
            probs,
            low_confidence_threshold=0.75,
            margin_threshold=0.15,
        )
        self.assertFalse(result["is_uncertain"])
        self.assertEqual(result["reasons"], [])

    def test_low_confidence_uncertain(self):
        probs = torch.tensor([0.62, 0.20, 0.10, 0.08], dtype=torch.float32)
        result = compute_uncertainty(
            probs,
            low_confidence_threshold=0.75,
            margin_threshold=0.15,
        )
        self.assertTrue(result["is_uncertain"])
        self.assertIn("low_confidence", result["reasons"])

    def test_close_top_two_uncertain(self):
        probs = torch.tensor([0.78, 0.70, 0.01, 0.01], dtype=torch.float32)
        probs = probs / probs.sum()
        result = compute_uncertainty(
            probs,
            low_confidence_threshold=0.75,
            margin_threshold=0.15,
        )
        self.assertTrue(result["is_uncertain"])
        self.assertIn("low_margin", result["reasons"])


if __name__ == "__main__":
    unittest.main()

