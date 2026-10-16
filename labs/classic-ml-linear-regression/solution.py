"""Linear regression: reference solution.

Parameters are returned as theta = [b, w_1, ..., w_d], intercept first.
X has shape (n, d) and has no column of ones; y has shape (n,).
Loss is the mean squared error: L(theta) = mean((Xa @ theta - y) ** 2),
where Xa is X with a column of ones prepended.
"""

import numpy as np


def _augment(X):
    """Prepends a column of ones so that the intercept is the first parameter."""
    X = np.asarray(X, dtype=np.float64)
    ones = np.ones((X.shape[0], 1))
    return np.hstack([ones, X])


def fit_normal_equation(X, y):
    """Least squares via lstsq (no explicit matrix inverse). Returns theta of shape (d + 1,)."""
    Xa = _augment(X)
    y = np.asarray(y, dtype=np.float64)
    theta, *_ = np.linalg.lstsq(Xa, y, rcond=None)
    return theta


def fit_gradient_descent(X, y, lr=0.1, steps=500):
    """Batch gradient descent from theta = 0 on the MSE.

    Returns (theta, losses). losses has steps + 1 values: the loss at every
    iterate, including the initial one and the final one.
    """
    Xa = _augment(X)
    y = np.asarray(y, dtype=np.float64)
    n = Xa.shape[0]
    theta = np.zeros(Xa.shape[1])
    losses = []
    for _ in range(steps):
        residual = Xa @ theta - y
        losses.append(float(np.mean(residual**2)))
        grad = (2.0 / n) * (Xa.T @ residual)
        theta = theta - lr * grad
    residual = Xa @ theta - y
    losses.append(float(np.mean(residual**2)))
    return theta, losses


def fit_ridge(X, y, lam):
    """Ridge regression with L2 penalty lam * ||w||^2. The intercept is not penalized.

    Solved as an augmented least-squares problem: stack sqrt(lam) * D under Xa,
    where D is the identity with a zero in the intercept position.
    """
    Xa = _augment(X)
    y = np.asarray(y, dtype=np.float64)
    k = Xa.shape[1]
    penalty = np.sqrt(lam) * np.diag([0.0] + [1.0] * (k - 1))
    A = np.vstack([Xa, penalty])
    b = np.concatenate([y, np.zeros(k)])
    theta, *_ = np.linalg.lstsq(A, b, rcond=None)
    return theta
