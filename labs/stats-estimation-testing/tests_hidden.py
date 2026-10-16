"""Hidden tests: coverage, invariances, edge cases and error handling.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import math

import numpy as np

Z_975 = 1.959964
T_975_DF4 = 2.776445
T_975_DF9 = 2.262157


def test_hidden_t_interval_coverage():
    rng = np.random.default_rng(1)
    samples = rng.normal(3.0, 2.0, size=(4000, 5))
    covered = 0
    for row in samples:
        low, high = ci_t(row, T_975_DF4)
        covered += low <= 3.0 <= high
    coverage = covered / 4000
    assert abs(coverage - 0.95) <= 0.015, "t interval coverage off on random input, seed 1"


def test_hidden_t_test_type_one_error():
    rng = np.random.default_rng(3)
    samples = rng.normal(0.0, 1.0, size=(4000, 10))
    rate = sum(t_test(row, 0.0, T_975_DF9)[1] for row in samples) / 4000
    assert abs(rate - 0.05) <= 0.015, "type I error rate off on random input, seed 3"


def test_hidden_p_value_at_critical_value_is_alpha():
    # Mean exactly z * sigma / sqrt(n) away from mu0 puts |z| at the 95% quantile.
    x = [Z_975 / 2] * 4
    z, p = z_test(x, 0.0, 1.0)
    assert abs(z - Z_975) <= 1e-6, "z statistic mismatch on a constructed sample"
    assert abs(p - 0.05) <= 1e-5, "p-value at the 95% critical value must be about 0.05"


def test_hidden_z_test_sign_symmetry():
    rng = np.random.default_rng(4)
    x = rng.normal(0.4, 1.0, size=12)
    z1, p1 = z_test(x, 0.0, 1.0)
    z2, p2 = z_test(-x, 0.0, 1.0)
    assert abs(z1 + z2) <= 1e-9 and abs(p1 - p2) <= 1e-12, "mismatch under sign flip"


def test_hidden_z_test_zero_effect():
    x = [0.5, -0.5, 0.5, -0.5]
    z, p = z_test(x, 0.0, 2.0)
    assert abs(z) <= 1e-12, "mean equal to mu0 must give z = 0"
    assert abs(p - 1.0) <= 1e-12, "mean equal to mu0 must give p = 1"


def test_hidden_t_test_scale_invariance():
    rng = np.random.default_rng(5)
    x = rng.normal(1.0, 1.0, size=8)
    t1, _ = t_test(x, 0.0, T_975_DF9)
    t2, _ = t_test(x * 10.0, 0.0, T_975_DF9)
    assert abs(t1 - t2) <= 1e-9, "t statistic must not change when data and mu0 are scaled"


def test_hidden_ci_translation_and_scale():
    rng = np.random.default_rng(6)
    x = rng.normal(0.0, 1.0, size=15)
    low, high = ci_t(x, T_975_DF9)
    low_s, high_s = ci_t(x + 5.0, T_975_DF9)
    assert_close(
        [low_s, high_s],
        [low + 5.0, high + 5.0],
        atol=1e-9,
        message="interval must shift with the data",
    )
    low_k, high_k = ci_known_sigma(x, 2.0, Z_975)
    base_low, base_high = ci_known_sigma(x, 1.0, Z_975)
    assert_close(
        [high_k - low_k],
        [2.0 * (base_high - base_low)],
        atol=1e-9,
        message="interval width must scale linearly with sigma",
    )


def test_hidden_interval_shrinks_with_n():
    rng = np.random.default_rng(7)
    x = rng.normal(0.0, 1.0, size=400)
    wide = ci_known_sigma(x[:25], 1.0, Z_975)
    narrow = ci_known_sigma(x, 1.0, Z_975)
    assert narrow[1] - narrow[0] < wide[1] - wide[0], "interval must narrow as n grows"


def test_hidden_constant_sample():
    low, high = ci_t([7.0, 7.0, 7.0], T_975_DF4)
    assert_close(
        [low, high],
        [7.0, 7.0],
        atol=1e-12,
        message="zero-variance sample must give a zero-width interval",
    )


def test_hidden_too_few_observations_raise():
    for fn, args in ((ci_t, ([1.0], T_975_DF4)), (t_test, ([1.0], 0.0, T_975_DF4))):
        try:
            fn(*args)
        except ValueError:
            continue
        raise AssertionError("expected ValueError for fewer than 2 observations")


def test_hidden_inputs_not_mutated():
    rng = np.random.default_rng(8)
    x = rng.normal(size=6)
    before = x.copy()
    ci_known_sigma(x, 1.0, Z_975)
    ci_t(x, T_975_DF4)
    z_test(x, 0.0, 1.0)
    t_test(x, 0.0, T_975_DF4)
    assert np.array_equal(x, before), "input must not be modified"


def test_hidden_list_input_and_finite_output():
    values = [0.1 * i for i in range(10)]
    low, high = ci_t(values, T_975_DF9)
    assert math.isfinite(low) and math.isfinite(high), "non-finite interval for list input"
    assert low < high, "interval must have positive width for a varying sample"
