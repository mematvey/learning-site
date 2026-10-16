"""Visible tests. `ridge_fit`, `soft_threshold`, `lasso_cd` and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def test_ridge_shape_and_hand_case():
    # X = [1, -1], y = [1, -1]: X^T X = 2, X^T y = 2, so w = 2 / (2 + lam).
    X = np.array([[1.0], [-1.0]])
    y = np.array([1.0, -1.0])
    w = ridge_fit(X, y, 2.0)
    assert w.shape == (1,), f"expected shape (1,), got {w.shape}"
    assert_close(w, [0.5], atol=1e-6, message="expected w = [0.5] for lam = 2")


def test_ridge_zero_penalty_matches_least_squares():
    rng = np.random.default_rng(11)
    X = rng.normal(size=(20, 3))
    y = X @ np.array([1.0, -2.0, 0.5]) + 0.01 * rng.normal(size=20)
    expected = np.linalg.lstsq(X, y, rcond=None)[0]
    assert_close(
        ridge_fit(X, y, 0.0),
        expected,
        atol=1e-6,
        message="with lam = 0 ridge must equal ordinary least squares",
    )


def test_soft_threshold_hand_case():
    # soft_threshold(2.0, 0.5) = 1.5, soft_threshold(-0.3, 0.5) = 0
    out = soft_threshold(np.array([2.0, -0.3]), 0.5)
    expected = [1.5, 0.0]
    assert_close(out, expected, atol=1e-9, message=f"expected {expected}, got {out.tolist()}")


def test_lasso_orthonormal_one_pass():
    # With X = I every coordinate is independent: w_j = soft_threshold(y_j, lam / 2).
    X = np.eye(3)
    y = np.array([2.0, -0.3, 1.0])
    w = lasso_cd(X, y, 1.0, n_iter=1)
    expected = [1.5, 0.0, 0.5]
    assert_close(w, expected, atol=1e-9, message=f"expected {expected}, got {w.tolist()}")
