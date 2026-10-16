"""Visible tests. `psi`, `ks_statistic` and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def test_psi_identical_samples_give_zero():
    x = np.arange(20, dtype=float)
    value = psi(x, x, bins=5)
    assert_close(value, 0.0, atol=1e-12, message=f"expected PSI 0 for equal samples, got {value}")


def test_psi_small_hand_case():
    # Reference 0..9 with 2 bins: the median edge is 4.5, so shares are 0.5 / 0.5.
    # Current [0, 1, 6, 7, 8] gives shares 0.4 / 0.6.
    # PSI = 0.1 * ln(0.5 / 0.4) + (-0.1) * ln(0.5 / 0.6)
    value = psi(np.arange(10, dtype=float), [0.0, 1.0, 6.0, 7.0, 8.0], bins=2)
    expected = 0.1 * np.log(1.25) + (-0.1) * np.log(0.5 / 0.6)
    assert_close(
        value, expected, atol=1e-6, message=f"expected PSI {expected:.6f}, got {value:.6f}"
    )


def test_psi_out_of_range_values_go_to_edge_bins():
    # Values far below and above the reference range must be counted, not dropped:
    # two of them go to the first bin and two to the last, so shares stay 0.5 / 0.5.
    value = psi(np.arange(10, dtype=float), [-100.0, -50.0, 100.0, 200.0], bins=2)
    assert_close(
        value,
        0.0,
        atol=1e-12,
        message=f"out-of-range values must go to edge bins, expected PSI 0, got {value}",
    )


def test_psi_empty_bin_is_finite():
    # All current values fall in the first bin, so the second bin is empty.
    # Its share is floored at 1e-4 instead of giving log(0).
    eps = 1e-4
    value = psi(np.arange(10, dtype=float), np.zeros(5), bins=2)
    expected = (0.5 - 1.0) * np.log(0.5 / 1.0) + (0.5 - eps) * np.log(0.5 / eps)
    assert np.isfinite(value), f"PSI must be finite when a bin is empty, got {value}"
    assert_close(
        value, expected, atol=1e-6, message=f"expected PSI {expected:.6f}, got {value:.6f}"
    )


def test_ks_hand_cases():
    assert_close(
        ks_statistic([1.0, 2.0, 3.0], [4.0, 5.0, 6.0]),
        1.0,
        atol=1e-12,
        message="fully separated samples must give D = 1",
    )
    assert_close(
        ks_statistic([1.0, 2.0], [1.5]),
        0.5,
        atol=1e-12,
        message="expected D = 0.5 for [1, 2] vs [1.5]",
    )
    assert_close(
        ks_statistic([1.0, 1.0, 2.0, 2.0], [1.0, 2.0, 2.0, 2.0]),
        0.25,
        atol=1e-12,
        message="ties must be handled: expected D = 0.25",
    )


def test_ks_identical_samples_give_zero():
    x = np.array([3.0, 1.0, 2.0, 5.0])
    assert_close(
        ks_statistic(x, x.copy()), 0.0, atol=1e-12, message="equal samples must give D = 0"
    )
