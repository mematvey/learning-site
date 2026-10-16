"""Visible tests: sigmoid, log-loss, predict_proba and gradient descent.

`assert_close` and `report_series` are provided by the harness.
"""

# ruff: noqa: F821
import numpy as np


def _separable_data(seed, n):
    """Points with a margin: the label is the sign of x1 + x2."""
    rng = np.random.default_rng(seed)
    X = rng.normal(size=(4 * n, 2))
    X = X[np.abs(X[:, 0] + X[:, 1]) > 0.5][:n]
    y = (X[:, 0] + X[:, 1] > 0).astype(float)
    return X, y


def test_sigmoid_known_values():
    z = np.array([[0.0, np.log(3.0)], [-np.log(3.0), 2.0]])
    expected = np.array([[0.5, 0.75], [0.25, 1.0 / (1.0 + np.exp(-2.0))]])
    assert_close(
        sigmoid(z), expected, atol=1e-9, rtol=1e-9,
        message="sigmoid must work elementwise and keep the shape of z",
    )


def test_log_loss_hand_case():
    # Zero logits give p = 0.5 for both points, so the mean loss is log 2.
    y = np.array([1.0, 0.0])
    assert_close(
        log_loss(y, np.zeros(2)), np.log(2.0), atol=1e-9, rtol=1e-9,
        message="log-loss at zero logits must be log 2",
    )


def test_predict_proba_matches_formula():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(5, 3))
    w = np.array([0.5, -1.0, 2.0])
    b = 0.25
    expected = 1.0 / (1.0 + np.exp(-(X @ w + b)))
    assert_close(
        predict_proba(X, w, b), expected, atol=1e-9, rtol=1e-9,
        message="predict_proba must return sigma(X w + b) with shape (n,)",
    )


def test_gd_first_step_uses_mean_gradient():
    # From w = 0, b = 0 the first step is -lr * X^T (0.5 - y) / n and -lr * mean(0.5 - y).
    X, y = _separable_data(seed=0, n=40)
    lr = 0.1
    w, b = fit_logreg_gd(X, y, lr=lr, n_iter=1)
    r = 0.5 - y
    assert_close(
        w, -lr * (X.T @ r) / len(y), atol=1e-9, rtol=1e-9,
        message="weight gradient must be the mean over the n points, X^T (p - y) / n",
    )
    assert_close(
        b, -lr * r.mean(), atol=1e-9, rtol=1e-9,
        message="bias gradient must be the mean of (p - y)",
    )


def test_separable_data_classified_perfectly():
    X, y = _separable_data(seed=1, n=40)
    w, b = fit_logreg_gd(X, y, lr=0.1, n_iter=500)
    pred = (predict_proba(X, w, b) > 0.5).astype(float)
    assert_close(
        pred, y, atol=0.0, rtol=0.0,
        message="with a margin in the data every point must be classified correctly",
    )
