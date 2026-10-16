"""Linear regression: starter code.

Parameters are theta = [b, w_1, ..., w_d], intercept first.
X has shape (n, d) and has no column of ones; y has shape (n,).
Loss is the mean squared error: L(theta) = mean((Xa @ theta - y) ** 2),
where Xa is X with a column of ones prepended.

Complete the three fitting functions so that they match the chapter text.
"""

import numpy as np


def _augment(X):
    """Prepends a column of ones so that the intercept is the first parameter."""
    X = np.asarray(X, dtype=np.float64)
    ones = np.ones((X.shape[0], 1))
    return np.hstack([ones, X])


def fit_normal_equation(X, y):
    """Least squares. Returns theta of shape (d + 1,)."""
    Xa = _augment(X)
    y = np.asarray(y, dtype=np.float64)
    # TODO: solve min ||Xa @ theta - y||^2 without an explicit matrix inverse
    theta = np.zeros(Xa.shape[1])
    return theta


def fit_gradient_descent(X, y, lr=0.1, steps=500):
    """Batch gradient descent from theta = 0 on the MSE.

    Returns (theta, losses). losses has steps + 1 values: the loss at every
    iterate, including the initial one and the final one.
    """
    Xa = _augment(X)
    y = np.asarray(y, dtype=np.float64)
    theta = np.zeros(Xa.shape[1])
    losses = []
    for _ in range(steps):
        residual = Xa @ theta - y
        losses.append(float(np.mean(residual**2)))
        # TODO: gradient of the MSE with respect to theta, then one step of size lr
        grad = np.zeros_like(theta)
        theta = theta - lr * grad
    residual = Xa @ theta - y
    losses.append(float(np.mean(residual**2)))
    return theta, losses


def fit_ridge(X, y, lam):
    """Ridge regression with L2 penalty lam * ||w||^2. The intercept is not penalized."""
    Xa = _augment(X)
    y = np.asarray(y, dtype=np.float64)
    # TODO: add the penalty for the slopes (not for the intercept) and solve
    theta = np.zeros(Xa.shape[1])
    return theta
