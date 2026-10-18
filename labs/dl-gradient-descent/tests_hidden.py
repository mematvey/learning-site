"""Hidden tests: edge cases, several features, step size and inputs.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def _mse(X, y, w, b):
    err = np.asarray(X, dtype=float) @ np.asarray(w, dtype=float) + b - np.asarray(y, dtype=float)
    return float(np.mean(err**2))


X1 = np.array([[0.0], [1.0], [2.0]])
Y1 = np.array([1.0, 3.0, 5.0])


def test_hidden_gradient_is_zero_at_minimum():
    grad_w, grad_b = gradient(X1, Y1, np.array([2.0]), 1.0)
    assert_close(grad_w, [0.0], atol=1e-9, message="gradient must vanish at the minimum (w, b)")
    assert_close(grad_b, 0.0, atol=1e-9, message="gradient must vanish at the minimum (w, b)")


def test_hidden_several_features_match_lstsq():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(50, 3))
    y = X @ np.array([1.5, -2.0, 0.5]) + 0.7
    sol, *_ = np.linalg.lstsq(np.column_stack([X, np.ones(50)]), y, rcond=None)
    w, b = gradient_descent(X, y, lr=0.05, steps=5000)
    assert_close(w, sol[:3], atol=1e-3, message="mismatch on random input, seed 0")
    assert_close(b, sol[3], atol=1e-3, message="mismatch on random input, seed 0")


def test_hidden_gradient_shape_for_three_features():
    rng = np.random.default_rng(1)
    X = rng.normal(size=(5, 3))
    y = rng.normal(size=5)
    grad_w, grad_b = gradient(X, y, np.zeros(3), 0.0)
    assert np.shape(grad_w) == (3,), "grad_w must have one entry per feature"
    assert np.shape(grad_b) == (), "grad_b must be a scalar"


def test_hidden_too_large_step_diverges():
    # On this data the largest safe step is about 0.42; lr = 1.0 must grow the loss.
    w, b = gradient_descent(X1, Y1, lr=1.0, steps=30)
    start = _mse(X1, Y1, np.zeros(1), 0.0)
    end = _mse(X1, Y1, w, b)
    assert (not np.isfinite(end)) or end > start, "loss must grow when the step is too large"


def test_hidden_small_step_is_slower():
    slow_w, slow_b = gradient_descent(X1, Y1, lr=0.01, steps=100)
    fast_w, fast_b = gradient_descent(X1, Y1, lr=0.1, steps=100)
    slow = _mse(X1, Y1, slow_w, slow_b)
    fast = _mse(X1, Y1, fast_w, fast_b)
    assert slow < _mse(X1, Y1, np.zeros(1), 0.0), "loss must decrease with a small step"
    assert fast < slow, "a moderate step must reach lower loss than a tiny one in the same steps"


def test_hidden_inputs_not_mutated():
    X = X1.copy()
    y = Y1.copy()
    w = np.array([0.5])
    w_copy = w.copy()
    gradient(X, y, w, 0.3)
    gradient_descent(X, y, lr=0.1, steps=10)
    assert np.array_equal(X, X1), "X must not be modified"
    assert np.array_equal(y, Y1), "y must not be modified"
    assert np.array_equal(w, w_copy), "w must not be modified"
