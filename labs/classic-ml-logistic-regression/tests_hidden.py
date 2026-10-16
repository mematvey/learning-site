"""Hidden tests: numerical stability, gradient, reference run and inputs.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def test_hidden_sigmoid_no_overflow():
    z = np.array([-1000.0, -745.0, 745.0, 1000.0])
    with np.errstate(over="raise", invalid="raise"):
        p = sigmoid(z)
    assert_close(p, [0.0, 0.0, 1.0, 1.0], atol=1e-12, rtol=0.0, message="large logits")


def test_hidden_sigmoid_symmetry():
    rng = np.random.default_rng(1)
    z = rng.normal(scale=50.0, size=20)
    assert_close(
        sigmoid(z) + sigmoid(-z), np.ones(20), atol=1e-12, rtol=0.0,
        message="sigma(z) + sigma(-z) must be 1",
    )


def test_hidden_log_loss_large_logits():
    y = np.array([1.0, 0.0, 1.0, 0.0])
    z = np.array([800.0, 800.0, -800.0, -800.0])
    with np.errstate(over="raise", invalid="raise", divide="raise"):
        loss = log_loss(y, z)
    assert_close(loss, 400.0, atol=1e-6, rtol=1e-9, message="log-loss at |z| = 800")


def test_hidden_log_loss_matches_definition():
    rng = np.random.default_rng(2)
    z = rng.normal(scale=2.0, size=30)
    y = (rng.random(30) < 0.5).astype(float)
    p = 1.0 / (1.0 + np.exp(-z))
    expected = -np.mean(y * np.log(p) + (1.0 - y) * np.log(1.0 - p))
    assert_close(log_loss(y, z), expected, atol=1e-9, rtol=1e-9, message="log-loss value")


def test_hidden_gradient_matches_finite_differences():
    rng = np.random.default_rng(3)
    X = rng.normal(size=(20, 3))
    y = (rng.random(20) < 0.5).astype(float)
    w = rng.normal(size=3)
    b = 0.3
    p = predict_proba(X, w, b)
    analytic = X.T @ (p - y) / len(y)
    h = 1e-6
    numeric = np.array(
        [
            (log_loss(y, X @ (w + h * e) + b) - log_loss(y, X @ (w - h * e) + b)) / (2 * h)
            for e in np.eye(3)
        ]
    )
    assert_close(
        analytic, numeric, atol=1e-6, rtol=1e-5,
        message="gradient must be X^T (p - y) / n",
    )


def test_hidden_gd_matches_reference():
    rng = np.random.default_rng(4)
    X = rng.normal(size=(30, 2))
    y = (X[:, 0] - 0.5 * X[:, 1] + 0.2 * rng.normal(size=30) > 0).astype(float)
    w, b = fit_logreg_gd(X, y, lr=0.1, n_iter=200)
    rw, rb = np.zeros(2), 0.0
    n = len(y)
    for _ in range(200):
        r = 1.0 / (1.0 + np.exp(-(X @ rw + rb))) - y
        rw, rb = rw - 0.1 * (X.T @ r) / n, rb - 0.1 * r.mean()
    assert_close(
        w, rw, atol=1e-8, rtol=1e-6,
        message="weights differ from the reference run (zero start, mean gradient)",
    )
    assert_close(b, rb, atol=1e-8, rtol=1e-6, message="bias differs from the reference run")


def test_hidden_inputs_not_mutated():
    rng = np.random.default_rng(5)
    X = rng.normal(size=(10, 2))
    y = (rng.random(10) < 0.5).astype(float)
    X_copy, y_copy = X.copy(), y.copy()
    fit_logreg_gd(X, y, lr=0.1, n_iter=5)
    assert np.array_equal(X, X_copy) and np.array_equal(y, y_copy), "inputs must not change"
