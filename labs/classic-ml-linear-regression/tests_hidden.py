"""Hidden tests: scale, rank deficiency, intercept handling and the shape of the loss history.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import itertools

import numpy as np


def _augment(X):
    X = np.asarray(X, dtype=np.float64)
    return np.hstack([np.ones((X.shape[0], 1)), X])


def _ols(X, y):
    """Reference least squares, computed independently of the learner's code."""
    Xa = np.hstack([np.ones((len(X), 1)), np.asarray(X, dtype=float)])
    theta, *_ = np.linalg.lstsq(Xa, np.asarray(y, dtype=float), rcond=None)
    return theta


def _close(a, b, atol=1e-6, rtol=1e-5):
    return np.allclose(a, b, atol=atol, rtol=rtol)


def test_hidden_random_normal_equation_matches_lstsq():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(30, 5))
    y = rng.normal(size=30)
    theta = fit_normal_equation(X, y)
    ref, *_ = np.linalg.lstsq(_augment(X), y, rcond=None)
    assert _close(theta, ref), "mismatch on random input, seed 0"


def test_hidden_rank_deficient_predictions():
    rng = np.random.default_rng(3)
    x = rng.normal(size=(20, 1))
    X = np.hstack([x, x])  # duplicate column: the normal matrix is singular
    y = 1.0 + 2.0 * x[:, 0] + 0.01 * rng.normal(size=20)
    theta = fit_normal_equation(X, y)
    ref, *_ = np.linalg.lstsq(_augment(X), y, rcond=None)
    assert _close(_augment(X) @ theta, _augment(X) @ ref, atol=1e-6), (
        "predictions must match on a rank-deficient design"
    )


def test_hidden_gradient_descent_history_length():
    rng = np.random.default_rng(4)
    X = rng.normal(size=(15, 2))
    y = rng.normal(size=15)
    _, losses = fit_gradient_descent(X, y, lr=0.1, steps=37)
    assert len(losses) == 38, "losses must have steps + 1 values"


def test_hidden_gradient_descent_converges_to_ols():
    rng = np.random.default_rng(5)
    X = rng.normal(size=(60, 1))
    y = -0.5 + 4.0 * X[:, 0] + 0.2 * rng.normal(size=60)
    theta_gd, _ = fit_gradient_descent(X, y, lr=0.1, steps=1000)
    theta_ne = _ols(X, y)
    assert _close(theta_gd, theta_ne, atol=1e-6), "1000 steps must reach the least-squares solution"


def test_hidden_ridge_matches_closed_form():
    rng = np.random.default_rng(6)
    X = rng.normal(size=(25, 3))
    y = rng.normal(size=25)
    lam = 0.7
    Xa = _augment(X)
    D = np.diag([0.0, 1.0, 1.0, 1.0])
    ref = np.linalg.solve(Xa.T @ Xa + lam * D, Xa.T @ y)
    assert _close(fit_ridge(X, y, lam), ref, atol=1e-8, rtol=1e-6), "mismatch for lam = 0.7"


def test_hidden_ridge_shrinks_slopes():
    rng = np.random.default_rng(7)
    X = rng.normal(size=(30, 4))
    y = X @ np.array([1.0, -2.0, 0.5, 3.0]) + rng.normal(size=30)
    norms = [np.linalg.norm(fit_ridge(X, y, lam)[1:]) for lam in (0.0, 1.0, 10.0, 100.0)]
    assert all(a > b for a, b in itertools.pairwise(norms)), "slope norm must shrink as lam grows"


def test_hidden_ridge_does_not_penalize_intercept():
    rng = np.random.default_rng(8)
    X = rng.normal(size=(30, 2))
    y = 5.0 + X @ np.array([1.0, 1.0]) + 0.1 * rng.normal(size=30)
    theta = fit_ridge(X, y, 1e8)
    assert np.allclose(theta[1:], 0.0, atol=1e-4), "slopes must vanish for huge lam"
    assert abs(theta[0] - y.mean()) < 1e-3, "intercept must stay near mean(y) for huge lam"


def test_hidden_inputs_not_mutated():
    rng = np.random.default_rng(9)
    X = rng.normal(size=(8, 2))
    y = rng.normal(size=8)
    X_copy, y_copy = X.copy(), y.copy()
    fit_normal_equation(X, y)
    fit_gradient_descent(X, y, lr=0.1, steps=10)
    fit_ridge(X, y, 0.5)
    assert np.array_equal(X, X_copy) and np.array_equal(y, y_copy), "inputs must not be modified"
