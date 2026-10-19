"""Hidden tests: random data, invariances and degenerate cases.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def _random_data(seed):
    rng = np.random.default_rng(seed)
    x = rng.uniform(-3.0, 3.0, size=20)
    y = 2.0 - 0.5 * x + rng.normal(scale=0.7, size=20)
    return x, y


def test_hidden_fit_matches_polyfit():
    x, y = _random_data(0)
    slope_ref, intercept_ref = np.polyfit(x, y, 1)
    intercept, slope = fit_ols(x, y)
    assert_close(
        [intercept, slope],
        [intercept_ref, slope_ref],
        atol=1e-9,
        rtol=1e-7,
        message="mismatch on random input, seed 0",
    )


def test_hidden_residuals_match_polyfit():
    x, y = _random_data(0)
    slope_ref, intercept_ref = np.polyfit(x, y, 1)
    e = residuals(x, y, intercept_ref, slope_ref)
    assert_close(
        e,
        y - (intercept_ref + slope_ref * x),
        atol=1e-9,
        rtol=1e-7,
        message="residuals mismatch on random input, seed 0",
    )
    assert_close(
        np.dot(e, x), 0.0, atol=1e-8, message="least squares residuals must be orthogonal to x"
    )


def test_hidden_se_matches_matrix_formula():
    x, y = _random_data(1)
    intercept, slope = fit_ols(x, y)
    design = np.column_stack([np.ones_like(x), x])
    e = y - design @ np.array([intercept, slope])
    sigma2 = np.sum(e**2) / (x.size - 2)
    cov = sigma2 * np.linalg.inv(design.T @ design)
    assert_close(
        slope_standard_error(x, y, intercept, slope),
        np.sqrt(cov[1, 1]),
        atol=1e-9,
        rtol=1e-7,
        message="standard error mismatch, seed 1",
    )


def test_hidden_interval_is_centered_on_slope():
    x, y = _random_data(2)
    _, slope = fit_ols(x, y)
    low, high = slope_confidence_interval(x, y, 2.5)
    assert_close(
        (low + high) / 2, slope, atol=1e-9, message="interval must be centred on the slope estimate"
    )
    assert low < high, "lower bound must be below upper bound"


def test_hidden_interval_width_is_linear_in_t():
    x, y = _random_data(3)
    low1, high1 = slope_confidence_interval(x, y, 1.0)
    low2, high2 = slope_confidence_interval(x, y, 2.0)
    assert_close(
        high2 - low2,
        2.0 * (high1 - low1),
        atol=1e-9,
        rtol=1e-9,
        message="interval width must scale linearly with t_quantile",
    )


def test_hidden_shift_and_scale_behaviour():
    x, y = _random_data(4)
    _, slope = fit_ols(x, y)
    _, slope_shifted = fit_ols(x + 100.0, y)
    assert_close(slope_shifted, slope, atol=1e-7, message="slope must not change when x is shifted")
    intercept3, slope3 = fit_ols(x, 3.0 * y)
    assert_close(slope3, 3.0 * slope, atol=1e-9, rtol=1e-9, message="slope must scale with y")
    se = slope_standard_error(x, y, *fit_ols(x, y))
    se3 = slope_standard_error(x, 3.0 * y, intercept3, slope3)
    assert_close(se3, 3.0 * se, atol=1e-9, rtol=1e-7, message="standard error must scale with y")


def test_hidden_perfect_line_has_zero_error():
    x = np.arange(1.0, 8.0)
    y = 1.0 + 2.0 * x
    intercept, slope = fit_ols(x, y)
    assert_close([intercept, slope], [1.0, 2.0], atol=1e-9, message="exact line must be recovered")
    assert_close(
        residuals(x, y, intercept, slope),
        np.zeros(7),
        atol=1e-9,
        message="residuals of an exact line must be zero",
    )
    assert_close(
        slope_standard_error(x, y, intercept, slope),
        0.0,
        atol=1e-9,
        message="standard error of an exact line must be zero",
    )


def test_hidden_large_offset_x_stays_accurate():
    x = 1e6 + np.arange(1.0, 6.0)
    y = np.array([2.1, 3.9, 6.2, 7.8, 10.1])
    _, slope = fit_ols(x, y)
    assert_close(slope, 1.99, atol=1e-6, message="slope must stay accurate for large x offsets")
