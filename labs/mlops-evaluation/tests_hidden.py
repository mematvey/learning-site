"""Hidden tests: determinism, symmetry, scale, correlated pairs and input checks.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def test_hidden_same_seed_gives_same_interval():
    rng = np.random.default_rng(20)
    a = (rng.random(120) < 0.7).astype(float)
    b = (rng.random(120) < 0.6).astype(float)
    assert accuracy_ci(a, seed=3) == accuracy_ci(a, seed=3), "accuracy_ci must be deterministic"
    assert paired_diff_ci(a, b, seed=3) == paired_diff_ci(a, b, seed=3), (
        "paired_diff_ci must be deterministic"
    )


def test_hidden_paired_swap_negates_interval():
    rng = np.random.default_rng(21)
    a = (rng.random(150) < 0.75).astype(float)
    b = (rng.random(150) < 0.65).astype(float)
    lo_ab, hi_ab = paired_diff_ci(a, b)
    lo_ba, hi_ba = paired_diff_ci(b, a)
    assert_close(
        [lo_ab, hi_ab],
        [-hi_ba, -lo_ba],
        atol=1e-9,
        message="swapping models must mirror the paired interval around zero",
    )


def test_hidden_identical_models_give_zero_interval():
    rng = np.random.default_rng(22)
    a = (rng.random(80) < 0.5).astype(float)
    low, high = paired_diff_ci(a, a.copy())
    assert_close(
        [low, high], [0.0, 0.0], atol=1e-12, message="identical models must give interval 0..0"
    )


def test_hidden_accuracy_width_matches_normal_scale():
    # For n = 2000 and p = 0.3 the normal half-width is 1.96 * sqrt(p(1-p)/n).
    rng = np.random.default_rng(23)
    x = (rng.random(2000) < 0.3).astype(float)
    low, high = accuracy_ci(x)
    expected = 2 * 1.96 * np.sqrt(0.3 * 0.7 / 2000)
    width = high - low
    assert abs(width - expected) < 0.15 * expected, (
        f"interval width on random input, seed 23: {width:.4f} is far from the expected scale"
    )


def test_hidden_higher_level_gives_wider_interval():
    rng = np.random.default_rng(24)
    a = (rng.random(200) < 0.6).astype(float)
    b = (rng.random(200) < 0.5).astype(float)
    w90 = accuracy_ci(a, level=0.90)[1] - accuracy_ci(a, level=0.90)[0]
    w99 = accuracy_ci(a, level=0.99)[1] - accuracy_ci(a, level=0.99)[0]
    assert w99 > w90, "a 99 % interval must be wider than a 90 % interval"
    p90 = paired_diff_ci(a, b, level=0.90)
    p99 = paired_diff_ci(a, b, level=0.99)
    assert p99[1] - p99[0] > p90[1] - p90[0], "paired 99 % interval must be wider than 90 %"


def test_hidden_correlated_pairs_are_narrower():
    # B agrees with A on 90 % of the examples, so the differences are mostly zero.
    rng = np.random.default_rng(25)
    a = (rng.random(300) < 0.7).astype(float)
    independent = (rng.random(300) < 0.7).astype(float)
    b = np.where(rng.random(300) < 0.9, a, independent)
    p_low, p_high = paired_diff_ci(a, b)
    u_low, u_high = unpaired_diff_ci(a, b)
    assert p_high - p_low < u_high - u_low, (
        "paired interval must be narrower than unpaired on correlated models"
    )


def test_hidden_length_mismatch_is_rejected():
    a = np.ones(10)
    b = np.ones(12)
    try:
        paired_diff_ci(a, b)
    except ValueError:
        return
    raise AssertionError("paired_diff_ci must raise ValueError for samples of different size")
