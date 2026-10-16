"""Logistic regression: starter code.

Complete the functions so that they match the chapter text.
Conventions: labels y are 0 or 1; z = X @ w + b are logits (raw scores).
"""

import numpy as np


def sigmoid(z):
    """Logistic function, elementwise. Shape of the output equals the shape of z."""
    z = np.asarray(z, dtype=np.float64)
    # TODO: avoid overflow for large |z| (exp(-z) overflows when z is very negative)
    return 1.0 / (1.0 + np.exp(-z))


def log_loss(y, z):
    """Mean binary cross-entropy computed from logits z and labels y."""
    y = np.asarray(y, dtype=np.float64)
    z = np.asarray(z, dtype=np.float64)
    # TODO: log(sigmoid(z)) becomes -inf for large |z|; compute the loss from z directly
    p = sigmoid(z)
    return float(-np.mean(y * np.log(p) + (1.0 - y) * np.log(1.0 - p)))


def predict_proba(X, w, b):
    """Probability of class 1 for each row of X, shape (n,)."""
    X = np.asarray(X, dtype=np.float64)
    w = np.asarray(w, dtype=np.float64)
    return sigmoid(X @ w + b)


def fit_logreg_gd(X, y, lr=0.1, n_iter=500):
    """Full-batch gradient descent. Starts from w = 0, b = 0. Returns (w, b)."""
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    d = X.shape[1]
    w = np.zeros(d)
    b = 0.0
    losses = []
    for _ in range(n_iter):
        z = X @ w + b
        losses.append(log_loss(y, z))
        residual = sigmoid(z) - y
        # TODO: the gradient of the mean loss is divided by n; the bias gradient is the mean
        w = w - lr * (X.T @ residual)
        b = b - lr * residual.sum()
    # TODO: record the loss curve for the chart: report_series("loss", ...)
    return w, b
