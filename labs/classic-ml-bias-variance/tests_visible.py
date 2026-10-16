"""Visible tests. `polynomial_features`, `fit_poly`, `bias_variance_estimate` and the
reporting helpers are provided by the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def test_polynomial_features_powers():
    x = np.array([0.0, 2.0, 3.0])
    X = polynomial_features(x, 3)
    expected = np.array([[1, 0, 0, 0], [1, 2, 4, 8], [1, 3, 9, 27]], dtype=float)
    assert_close(X, expected, message=f"expected shape (3, 4) with powers 0..3, got {X.shape}")


def test_fit_poly_recovers_line():
    x = np.array([0.0, 1.0, 2.0, 3.0])
    y = 2.0 * x + 1.0
    w = fit_poly(x, y, 1)
    assert_close(w, [1.0, 2.0], atol=1e-8)


def test_fit_poly_quadratic_without_noise():
    x = np.linspace(-1.0, 1.0, 9)
    y = 1.0 - 3.0 * x + 0.5 * x**2
    w = fit_poly(x, y, 2)
    assert_close(w, [1.0, -3.0, 0.5], atol=1e-8)


def test_decomposition_identity():
    # bias^2 + variance equals the mean squared error against the noiseless target.
    for degree in (1, 3, 5):
        bias2, variance, mse = bias_variance_estimate(degree, 100)
        assert bias2 >= 0 and variance >= 0, f"degree {degree}: bias2 and variance must be >= 0"
        assert_close(
            bias2 + variance, mse, atol=1e-9, rtol=1e-9,
            message=f"degree {degree}: bias2 + variance must equal mse",
        )


def test_sweep_bias_falls_variance_grows():
    degrees = [1, 2, 3, 4, 5, 6, 7]
    rows = np.array([bias_variance_estimate(d, 200) for d in degrees])  # (D, 3)
    bias2, variance, mse = rows[:, 0], rows[:, 1], rows[:, 2]
    for name, ys in (("bias2", bias2), ("variance", variance), ("mse", mse)):
        report_series(name, degrees, ys, label=name)
    assert bias2[4] < bias2[0], (
        f"bias2 at degree 5 must be below bias2 at degree 1, got {bias2[4]:.4g} and {bias2[0]:.4g}"
    )
    assert np.all(np.diff(variance[2:]) > 0), (
        f"variance must grow for degrees 3..7, got {variance[2:].tolist()}"
    )
