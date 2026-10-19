"""Visible tests. The functions and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def _log_loss(p, y):
    p = np.clip(np.asarray(p, dtype=np.float64), 1e-12, 1 - 1e-12)
    y = np.asarray(y, dtype=np.float64)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def test_ece_hand_case():
    # Two bins of width 0.5. Bin [0, 0.5): mean prob 0.25, accuracy 0.25, gap 0.
    # Bin [0.5, 1]: mean prob 0.8375, accuracy 0.5, gap 0.3375. ECE = 0.5 * 0.3375.
    probs = [0.2, 0.3, 0.4, 0.1, 0.9, 0.8, 0.7, 0.95]
    labels = [0, 0, 0, 1, 1, 1, 0, 0]
    ece = expected_calibration_error(probs, labels, n_bins=2)
    assert_close(ece, 0.16875, atol=1e-9, message=f"expected ECE 0.16875, got {ece}")


def test_ece_is_zero_for_constant_matching_frequency():
    probs = [0.5, 0.5, 0.5, 0.5]
    labels = [1, 1, 0, 0]
    ece = expected_calibration_error(probs, labels, n_bins=10)
    assert_close(ece, 0.0, atol=1e-9, message=f"expected ECE 0 for matching frequency, got {ece}")


def test_platt_probs_hand_case():
    # logit(0.5) = 0 gives sigmoid(-1); logit(0.75) = ln 3 gives sigmoid(ln 3 - 1) = 3 / (e + 3).
    p = platt_probs([0.5, 0.75], a=1.0, b=-1.0)
    expected = [1.0 / (1.0 + np.e), 3.0 / (np.e + 3.0)]
    assert_close(p, expected, atol=1e-9, message=f"expected {expected}, got {p.tolist()}")


def test_fit_platt_lowers_log_loss():
    scores = np.array([0.12, 0.27, 0.38, 0.45, 0.55, 0.62, 0.73, 0.88])
    labels = np.array([0, 0, 1, 0, 0, 1, 1, 1])
    a, b = fit_platt(scores, labels)
    assert a > 0, f"positive scores must map to higher probability, got a = {a:.3f}"
    before = _log_loss(platt_probs(scores, 1.0, 0.0), labels)
    after = _log_loss(platt_probs(scores, a, b), labels)
    assert after < before, f"fitted log-loss {after:.4f} must be below start {before:.4f}"


def test_best_threshold_hand_case():
    t = best_threshold(1.0, 50.0)
    assert_close(t, 1.0 / 51.0, atol=1e-12, message=f"expected 1/51, got {t}")


def test_weighted_probability_hand_case():
    # 0.1 with weight 9: 9 * 0.1 / (9 * 0.1 + 0.9) = 0.9 / 1.8 = 0.5
    p = weighted_probability(0.1, 9.0)
    assert_close(p, 0.5, atol=1e-9, message=f"expected 0.5, got {p}")
