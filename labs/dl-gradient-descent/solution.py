"""Gradient descent for linear regression with mean squared error: reference solution."""

import numpy as np


def gradient(X, y, w, b):
    """Gradient of the mean squared error with respect to the weights and the bias.

    X: array of shape (N, d), y: array of shape (N,), w: array of shape (d,), b: float.
    Returns (grad_w, grad_b): an array of shape (d,) and a float.
    The loss is L = mean((X @ w + b - y) ** 2).
    """
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    w = np.asarray(w, dtype=np.float64)
    n = X.shape[0]
    err = X @ w + b - y
    grad_w = 2.0 * (X.T @ err) / n
    grad_b = 2.0 * err.sum() / n
    return grad_w, float(grad_b)


def gradient_descent(X, y, lr, steps):
    """Fits w and b by `steps` updates of gradient descent, starting from w = 0, b = 0.

    lr: learning rate (step size). Returns (w, b): an array of shape (d,) and a float.
    """
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    w = np.zeros(X.shape[1])
    b = 0.0
    for _ in range(steps):
        grad_w, grad_b = gradient(X, y, w, b)
        w = w - lr * grad_w
        b = b - lr * grad_b
    return w, b
