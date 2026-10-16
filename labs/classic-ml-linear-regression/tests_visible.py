"""Visible tests. `fit_normal_equation`, `fit_gradient_descent` and `fit_ridge` come from the learner's code.

theta = [b, w_1, ..., w_d], intercept first. Loss is the mean squared error.
"""

# ruff: noqa: F821
import numpy as np


def _ols(X, y):
    """Reference least squares, computed independently of the learner's code."""
    Xa = np.hstack([np.ones((len(X), 1)), np.asarray(X, dtype=float)])
    theta, *_ = np.linalg.lstsq(Xa, np.asarray(y, dtype=float), rcond=None)
    return theta


def test_normal_equation_exact_line():
    # y = 2 + 3x is exactly linear, so the fit must recover [b, w] = [2, 3].
    X = np.array([[0.0], [1.0], [2.0], [3.0]])
    y = 2.0 + 3.0 * X[:, 0]
    theta = fit_normal_equation(X, y)
    assert_close(
        theta, [2.0, 3.0], message=f"expected theta [2, 3], got {np.round(theta, 6).tolist()}"
    )


def test_normal_equation_shape():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(10, 3))
    y = rng.normal(size=10)
    theta = fit_normal_equation(X, y)
    assert theta.shape == (4,), f"expected theta shape (4,) for d = 3, got {theta.shape}"


def test_gradient_descent_matches_normal_equation():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(50, 2))
    y = 1.5 + X @ np.array([2.0, -1.0]) + 0.1 * rng.normal(size=50)
    theta_gd, _ = fit_gradient_descent(X, y, lr=0.1, steps=500)
    theta_ne = _ols(X, y)
    assert_close(
        theta_gd,
        theta_ne,
        atol=1e-6,
        rtol=1e-5,
        message="gradient descent after 500 steps must reach the least-squares solution",
    )


def test_gradient_descent_loss_decreases():
    rng = np.random.default_rng(1)
    X = rng.normal(size=(40, 2))
    y = X @ np.array([1.0, 0.5]) + rng.normal(size=40) * 0.1
    _, losses = fit_gradient_descent(X, y, lr=0.05, steps=100)
    assert len(losses) == 101, f"expected steps + 1 = 101 loss values, got {len(losses)}"
    assert losses[-1] < losses[0] * 0.5, "gradient descent must make real progress"
    diffs = np.diff(losses)
    assert np.all(diffs <= 1e-12), "loss must not increase with a small learning rate"
    report_series("loss", range(len(losses)), losses, label="MSE")


def test_ridge_zero_penalty_matches_normal_equation():
    rng = np.random.default_rng(2)
    X = rng.normal(size=(20, 3))
    y = rng.normal(size=20)
    assert_close(
        fit_ridge(X, y, 0.0),
        _ols(X, y),
        atol=1e-8,
        rtol=1e-6,
        message="ridge with lam = 0 must equal ordinary least squares",
    )
