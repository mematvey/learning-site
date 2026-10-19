"""Hidden tests: edge cases, determinism and agreement between methods.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np

GROUP_A = np.array([13, 12, 18, 11, 16, 15, 14, 19], dtype=float)
GROUP_B = np.array([17, 26, 22, 24, 18, 21, 20, 19], dtype=float)


def test_hidden_bootstrap_se_matches_plug_in_on_normal_data():
    rng = np.random.default_rng(11)
    x = rng.normal(loc=3.0, scale=2.0, size=400)
    expected = np.std(x) / np.sqrt(x.size)
    assert_close(
        bootstrap_se(x, n_boot=5000, seed=1),
        expected,
        rtol=0.05,
        message="bootstrap SE of the mean must match std/sqrt(n) on normal data",
    )


def test_hidden_constant_sample_has_zero_width():
    x = np.full(10, 5.0)
    assert_close(
        bootstrap_se(x, n_boot=500, seed=0),
        0.0,
        atol=1e-12,
        message="constant sample must give zero bootstrap SE",
    )
    lo, hi = percentile_interval(x, n_boot=500, seed=0)
    assert_close([lo, hi], [5.0, 5.0], atol=1e-12, message="constant sample must give a point")


def test_hidden_interval_nested_by_level():
    lo95, hi95 = percentile_interval(GROUP_A, level=0.95, n_boot=4000, seed=3)
    lo50, hi50 = percentile_interval(GROUP_A, level=0.50, n_boot=4000, seed=3)
    assert lo95 <= lo50 <= hi50 <= hi95, "a 50% interval must lie inside the 95% interval"


def test_hidden_seed_makes_results_reproducible():
    first = percentile_interval(GROUP_A, n_boot=2000, seed=7)
    second = percentile_interval(GROUP_A, n_boot=2000, seed=7)
    assert first == second, "same seed must give the same interval"
    p1 = permutation_pvalue(GROUP_A, GROUP_B, method="mc", n_perm=2000, seed=7)
    p2 = permutation_pvalue(GROUP_A, GROUP_B, method="mc", n_perm=2000, seed=7)
    assert p1 == p2, "same seed must give the same Monte Carlo p-value"


def test_hidden_exact_pvalue_is_symmetric():
    p_ab = permutation_pvalue(GROUP_A, GROUP_B, method="exact")
    p_ba = permutation_pvalue(GROUP_B, GROUP_A, method="exact")
    assert_close(p_ab, p_ba, atol=1e-12, message="two-sided p must not depend on group order")


def test_hidden_exact_small_case():
    # Groups {1, 2} and {3, 4}: 2 of the C(4, 2) = 6 splits have |difference| >= 2.
    p = permutation_pvalue(np.array([1.0, 2.0]), np.array([3.0, 4.0]), method="exact")
    assert_close(p, 1 / 3, atol=1e-12, message="expected exact p = 1/3 for the 2 vs 2 case")


def test_hidden_identical_groups_give_p_one():
    a = np.array([1.0, 2.0, 3.0])
    b = np.array([1.0, 2.0, 3.0])
    assert_close(
        permutation_pvalue(a, b, method="exact"),
        1.0,
        atol=1e-12,
        message="identical groups must give p = 1 exactly",
    )


def test_hidden_mc_converges_to_exact():
    p_exact = permutation_pvalue(GROUP_A, GROUP_B, method="exact")
    p_mc = permutation_pvalue(GROUP_A, GROUP_B, method="mc", n_perm=20000, seed=5)
    assert abs(p_mc - p_exact) < 0.002, "Monte Carlo p must agree with the exact p"
    assert 0.0 < p_mc <= 1.0, "p-value must be in (0, 1]"


def test_hidden_inputs_not_mutated():
    a = GROUP_A.copy()
    b = GROUP_B.copy()
    bootstrap_se(a, n_boot=200, seed=0)
    percentile_interval(a, n_boot=200, seed=0)
    permutation_pvalue(a, b, method="exact")
    permutation_pvalue(a, b, method="mc", n_perm=200, seed=0)
    assert np.array_equal(a, GROUP_A) and np.array_equal(b, GROUP_B), "input must not change"
