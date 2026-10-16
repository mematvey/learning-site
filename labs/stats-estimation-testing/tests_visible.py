"""Visible tests. `ci_known_sigma`, `ci_t`, `z_test`, `t_test` and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np

Z_975 = 1.959964  # z quantile for a two-sided 95% interval
T_975_DF4 = 2.776445  # t quantile for a two-sided 95% interval, n = 5 (4 degrees of freedom)


def test_ci_known_sigma_hand_case():
    # mean 2.5, n = 4, sigma = 1: half-width = z / 2
    low, high = ci_known_sigma([1.0, 2.0, 3.0, 4.0], 1.0, Z_975)
    expected = [1.520018, 3.479982]
    assert_close(
        [low, high], expected, atol=1e-6, message=f"expected interval {expected}, got {[low, high]}"
    )


def test_ci_t_hand_case():
    # mean 4, sample std sqrt(2), n = 5: half-width = t * sqrt(2) / sqrt(5)
    low, high = ci_t([2.0, 4.0, 4.0, 4.0, 6.0], T_975_DF4)
    expected = [2.244022, 5.755978]
    assert_close(
        [low, high], expected, atol=1e-6, message=f"expected interval {expected}, got {[low, high]}"
    )


def test_z_test_hand_case():
    # z = (1.5 - 0) / (1 / sqrt(4)) = 3, two-sided p = 2 * (1 - Phi(3))
    z, p = z_test([1.5, 1.5, 1.5, 1.5], 0.0, 1.0)
    assert_close(z, 3.0, atol=1e-9, message=f"expected z = 3.0, got {z}")
    assert_close(p, 0.0026998, atol=1e-6, message=f"expected p = 0.0026998, got {p}")


def test_t_test_decisions():
    x = [2.0, 4.0, 4.0, 4.0, 6.0]
    t0, reject0 = t_test(x, 4.0, T_975_DF4)
    assert_close(t0, 0.0, atol=1e-9, message=f"expected t = 0 for mu0 = mean, got {t0}")
    assert reject0 is False, "mu0 equal to the sample mean must not be rejected"
    t1, reject1 = t_test(x, 0.0, T_975_DF4)
    assert_close(t1, 6.324555, atol=1e-5, message=f"expected t = 6.324555, got {t1}")
    assert reject1 is True, "t = 6.32 is above the critical value 2.776, must be rejected"


def test_ci_known_sigma_covers_mean_about_95_percent():
    # Repeat the experiment with a known mean 0: about 95% of intervals must cover it.
    rng = np.random.default_rng(0)
    samples = rng.normal(0.0, 1.0, size=(1000, 20))
    covered = 0
    for row in samples:
        low, high = ci_known_sigma(row, 1.0, Z_975)
        covered += low <= 0.0 <= high
    coverage = covered / 1000
    report_metric("coverage_known_sigma", coverage)
    assert abs(coverage - 0.95) <= 0.02, f"expected coverage near 0.95, got {coverage}"
