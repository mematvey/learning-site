"""Hidden tests: manual references, recovery of known parameters, ordering and edge cases.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def _ece_reference(probs, labels, n_bins):
    n = len(probs)
    total = 0.0
    for m in range(n_bins):
        idx = [i for i, p in enumerate(probs) if min(int(p * n_bins), n_bins - 1) == m]
        if not idx:
            continue
        conf = sum(probs[i] for i in idx) / len(idx)
        acc = sum(labels[i] for i in idx) / len(idx)
        total += len(idx) / n * abs(acc - conf)
    return total


def test_hidden_ece_matches_reference_loop():
    rng = np.random.default_rng(0)
    probs = rng.uniform(size=200).tolist()
    labels = rng.integers(0, 2, size=200).tolist()
    for n_bins in (5, 10):
        ece = expected_calibration_error(probs, labels, n_bins=n_bins)
        ref = _ece_reference(probs, labels, n_bins)
        assert_close(
            ece, ref, atol=1e-9, message=f"mismatch on random input, seed 0, bins {n_bins}"
        )


def test_hidden_ece_in_unit_interval():
    rng = np.random.default_rng(1)
    probs = rng.uniform(size=50)
    labels = rng.integers(0, 2, size=50)
    ece = expected_calibration_error(probs, labels)
    assert 0.0 <= ece <= 1.0, f"ECE must lie in [0, 1], got {ece}"


def test_hidden_platt_recovers_known_parameters():
    rng = np.random.default_rng(2)
    scores = rng.normal(size=20000)
    p_true = 1.0 / (1.0 + np.exp(-(2.0 * scores - 1.0)))
    labels = (rng.uniform(size=scores.size) < p_true).astype(float)
    a, b = fit_platt(scores, labels)
    assert abs(a - 2.0) < 0.15, f"slope a far from the generating value, got {a:.3f}"
    assert abs(b + 1.0) < 0.15, f"intercept b far from the generating value, got {b:.3f}"


def test_hidden_platt_keeps_order():
    rng = np.random.default_rng(3)
    scores = np.sort(rng.normal(size=300))
    labels = (rng.uniform(size=300) < 1.0 / (1.0 + np.exp(-scores))).astype(float)
    a, b = fit_platt(scores, labels)
    p = platt_probs(scores, a, b)
    assert np.all(np.diff(p) >= 0), "monotone calibration must not change the order of objects"


def test_hidden_platt_probs_stay_finite():
    p = platt_probs([-1e6, 0.0, 1e6], a=50.0, b=0.0)
    assert np.all(np.isfinite(p)), "platt_probs must not overflow for large inputs"
    assert_close(p, [0.0, 0.5, 1.0], atol=1e-9, message="saturated sigmoid values are wrong")


def test_hidden_threshold_minimizes_expected_cost():
    rng = np.random.default_rng(4)
    p = rng.uniform(size=2000)
    c_fp, c_fn = 1.0, 50.0

    def cost(t):
        # Positive decision when p > t: expected cost of a false alarm (1 - p) * c_fp.
        # Negative decision otherwise: expected cost of a miss p * c_fn.
        pos = p > t
        return float(np.sum((1 - p[pos]) * c_fp) + np.sum(p[~pos] * c_fn))

    t_star = best_threshold(c_fp, c_fn)
    best_grid = min(cost(t) for t in np.linspace(0.0, 1.0, 201))
    assert cost(t_star) <= best_grid + 1e-9, "threshold must not be beaten by a grid threshold"


def test_hidden_weighted_probability_limits():
    assert_close(
        weighted_probability(0.3, 1.0), 0.3, atol=1e-12, message="weight 1 must not change p"
    )
    assert_close(weighted_probability(0.0, 9.0), 0.0, atol=1e-12, message="p = 0 must stay 0")
    assert_close(weighted_probability(1.0, 9.0), 1.0, atol=1e-12, message="p = 1 must stay 1")
