"""Hidden tests: optimality, limits, scale and edge cases.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import itertools

import numpy as np


def _lasso_kkt_gap(X, y, w, lam):
    """Largest violation of the lasso optimality conditions for the sum-of-squares objective."""
    g = 2.0 * X.T @ (y - X @ w)
    gap = 0.0
    for j in range(len(w)):
        if w[j] != 0.0:
            gap = max(gap, abs(g[j] - lam * np.sign(w[j])))
        else:
            gap = max(gap, max(abs(g[j]) - lam, 0.0))
    return gap


def test_hidden_ridge_matches_augmented_lstsq():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(15, 4))
    y = rng.normal(size=15)
    lam = 3.0
    # ridge is ordinary least squares on [X; sqrt(lam) I] with targets [y; 0]
    X_aug = np.vstack([X, np.sqrt(lam) * np.eye(4)])
    y_aug = np.concatenate([y, np.zeros(4)])
    expected = np.linalg.lstsq(X_aug, y_aug, rcond=None)[0]
    assert_close(
        ridge_fit(X, y, lam), expected, atol=1e-6, message="mismatch on random input, seed 0"
    )


def test_hidden_ridge_rank_deficient_is_finite():
    rng = np.random.default_rng(1)
    a = rng.normal(size=(10, 1))
    X = np.hstack([a, a])  # two identical columns: X^T X is singular
    y = a[:, 0] * 2.0
    w = ridge_fit(X, y, 1.0)
    assert np.all(np.isfinite(w)), "ridge must give finite weights when X^T X is singular"


def test_hidden_ridge_shrinks_with_lambda():
    rng = np.random.default_rng(2)
    X = rng.normal(size=(12, 3))
    y = rng.normal(size=12)
    norms = [np.linalg.norm(ridge_fit(X, y, lam)) for lam in (0.0, 0.1, 1.0, 10.0, 1e6)]
    assert all(a >= b for a, b in itertools.pairwise(norms)), "weight norm must not grow with lam"
    assert norms[-1] < 1e-3 * norms[0], "very large lam must shrink weights close to zero"


def test_hidden_soft_threshold_properties():
    z = np.array([-3.0, -0.5, 0.0, 0.4, 2.5])
    out = soft_threshold(z, 0.5)
    assert out.shape == z.shape, f"expected shape {z.shape}, got {out.shape}"
    assert_close(
        out,
        [-2.5, 0.0, 0.0, 0.0, 2.0],
        atol=1e-9,
        message="soft_threshold mismatch on vector input",
    )
    assert_close(
        soft_threshold(-z, 0.5),
        -out,
        atol=1e-9,
        message="soft_threshold must be odd: f(-z) = -f(z)",
    )
    assert_close(
        soft_threshold(z, 0.0), z, atol=1e-9, message="threshold 0 must return the input unchanged"
    )


def test_hidden_lasso_kkt_conditions():
    rng = np.random.default_rng(3)
    X = rng.normal(size=(40, 6))
    y = X @ np.array([2.0, 0.0, -1.5, 0.0, 0.0, 0.7]) + 0.1 * rng.normal(size=40)
    lam = 5.0
    w = lasso_cd(X, y, lam, n_iter=2000)
    gap = _lasso_kkt_gap(X, y, w, lam)
    assert gap < 1e-4, "lasso optimality conditions violated on random input, seed 3"


def test_hidden_lasso_large_lambda_gives_zero():
    rng = np.random.default_rng(4)
    X = rng.normal(size=(10, 3))
    y = rng.normal(size=10)
    w = lasso_cd(X, y, 1e6, n_iter=50)
    assert_close(w, np.zeros(3), atol=1e-12, message="huge lam must give all-zero weights")


def test_hidden_lasso_zero_lambda_matches_least_squares():
    rng = np.random.default_rng(5)
    X = rng.normal(size=(30, 3))
    y = X @ np.array([1.0, -1.0, 2.0]) + 0.05 * rng.normal(size=30)
    expected = np.linalg.lstsq(X, y, rcond=None)[0]
    assert_close(
        lasso_cd(X, y, 0.0, n_iter=300),
        expected,
        atol=1e-5,
        message="with lam = 0 lasso must equal least squares",
    )


def test_hidden_lasso_zero_column_is_safe():
    rng = np.random.default_rng(6)
    X = rng.normal(size=(8, 3))
    X[:, 1] = 0.0
    y = rng.normal(size=8)
    w = lasso_cd(X, y, 0.5, n_iter=200)
    assert np.all(np.isfinite(w)), "zero column must not cause division by zero"
    assert_close(w[1], 0.0, atol=1e-12, message="weight of an all-zero column must be 0")


def test_hidden_inputs_not_mutated():
    rng = np.random.default_rng(7)
    X = rng.normal(size=(6, 2))
    y = rng.normal(size=6)
    X_copy, y_copy = X.copy(), y.copy()
    ridge_fit(X, y, 1.0)
    lasso_cd(X, y, 1.0, n_iter=5)
    assert np.array_equal(X, X_copy) and np.array_equal(y, y_copy), "inputs must not be modified"
