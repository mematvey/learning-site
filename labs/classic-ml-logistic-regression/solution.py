"""Logistic regression: reference solution."""

import numpy as np


def sigmoid(z):
    """Numerically stable logistic function, elementwise.

    Never calls exp of a large positive number: exp(-|z|) is always <= 1.
    """
    z = np.asarray(z, dtype=np.float64)
    e = np.exp(-np.abs(z))
    return np.where(z >= 0, 1.0 / (1.0 + e), e / (1.0 + e))


def log_loss(y, z):
    """Mean log-loss from logits z (raw scores) and labels y in {0, 1}.

    Uses log(1 + exp(z)) = logaddexp(0, z), so no log(0) appears for large |z|.
    """
    y = np.asarray(y, dtype=np.float64)
    z = np.asarray(z, dtype=np.float64)
    return float(np.mean(np.logaddexp(0.0, z) - y * z))


def predict_proba(X, w, b):
    """Probability of class 1 for each row of X, shape (n,)."""
    X = np.asarray(X, dtype=np.float64)
    w = np.asarray(w, dtype=np.float64)
    return sigmoid(X @ w + b)


def fit_logreg_gd(X, y, lr=0.1, n_iter=500):
    """Full-batch gradient descent on the mean log-loss.

    Starts from w = 0, b = 0. Each step uses the mean gradient X^T (p - y) / n
    and updates w and b simultaneously. Records the loss before each step.
    Returns (w, b).
    """
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    n, d = X.shape
    w = np.zeros(d)
    b = 0.0
    losses = []
    for _ in range(n_iter):
        z = X @ w + b
        losses.append(log_loss(y, z))
        residual = sigmoid(z) - y
        w = w - lr * (X.T @ residual) / n
        b = b - lr * residual.mean()
    report_series("loss", list(range(n_iter)), losses, label="log-loss")  # noqa: F821
    return w, b
