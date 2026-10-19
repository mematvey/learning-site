"""Visible tests. `bootstrap_se`, `percentile_interval`, `permutation_pvalue` and
`assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np

GROUP_A = np.array([13, 12, 18, 11, 16, 15, 14, 19], dtype=float)
GROUP_B = np.array([17, 26, 22, 24, 18, 21, 20, 19], dtype=float)


def test_bootstrap_se_close_to_plug_in_formula():
    # For the mean, the bootstrap SE is close to std(x) / sqrt(n) with the 1/n variance.
    expected = 0.93
    se = bootstrap_se(GROUP_A, n_boot=20000, seed=0)
    assert_close(
        se, expected, atol=0.02, message=f"expected bootstrap SE about {expected}, got {se:.4f}"
    )


def test_percentile_interval_brackets_the_mean():
    lo, hi = percentile_interval(GROUP_A, level=0.95, n_boot=20000, seed=0)
    mean = GROUP_A.mean()
    assert lo < mean < hi, f"interval ({lo:.3f}, {hi:.3f}) must contain the mean {mean}"
    assert_close(
        [lo, hi],
        [13.0, 16.6],
        atol=0.1,
        message=f"expected about [13.0, 16.6], got [{lo:.3f}, {hi:.3f}]",
    )


def test_exact_pvalue_for_eight_vs_eight():
    # 22 of the C(16, 8) = 12870 splits have |difference| >= 6.125.
    p = permutation_pvalue(GROUP_A, GROUP_B, method="exact")
    assert_close(p, 22 / 12870, atol=1e-12, message=f"expected exact p = 22/12870, got {p}")


def test_monte_carlo_pvalue_close_to_exact():
    p_mc = permutation_pvalue(GROUP_A, GROUP_B, method="mc", n_perm=10000, seed=0)
    assert_close(
        p_mc, 22 / 12870, atol=0.002, message=f"Monte Carlo p = {p_mc} should be close to 22/12870"
    )
