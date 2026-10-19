"""Visible tests. `fit_ols`, `residuals`, `slope_standard_error`, `slope_confidence_interval`
and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import math

import numpy as np

X = [1.0, 2.0, 3.0, 4.0, 5.0]
Y = [2.1, 3.9, 6.2, 7.8, 10.1]


def test_fit_ols_hand_case():
    intercept, slope = fit_ols(X, Y)
    assert_close(intercept, 0.05, atol=1e-9, message=f"expected intercept 0.05, got {intercept}")
    assert_close(slope, 1.99, atol=1e-9, message=f"expected slope 1.99, got {slope}")


def test_residuals_hand_case():
    e = residuals(X, Y, 0.05, 1.99)
    expected = [0.06, -0.13, 0.18, -0.21, 0.10]
    assert np.shape(e) == (5,), f"expected shape (5,), got {np.shape(e)}"
    assert_close(e, expected, atol=1e-9, message=f"expected residuals {expected}, got {list(e)}")


def test_standard_error_hand_case():
    se = slope_standard_error(X, Y, 0.05, 1.99)
    expected = math.sqrt(0.107 / 3 / 10)  # about 0.0597
    assert_close(se, expected, atol=1e-6, message=f"expected SE {expected:.6f}, got {se:.6f}")


def test_confidence_interval_hand_case():
    # n - 2 = 3 degrees of freedom, 95% two-sided quantile 3.182.
    low, high = slope_confidence_interval(X, Y, 3.182)
    assert_close(
        [low, high],
        [1.799966, 2.180034],
        atol=1e-5,
        message=f"expected interval about [1.80, 2.18], got [{low:.5f}, {high:.5f}]",
    )
