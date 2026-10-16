"""Bias-variance decomposition with polynomial regression: reference solution."""

import numpy as np


def target(x):
    """True function of the experiment."""
    return np.sin(2 * np.pi * x)


def polynomial_features(x, degree):
    """Polynomial design matrix.

    x: 1-D array of n points. Returns an (n, degree + 1) array whose column k holds x**k.
    """
    x = np.asarray(x, dtype=np.float64).ravel()
    return np.column_stack([x**k for k in range(degree + 1)])


def fit_poly(x, y, degree):
    """Least-squares polynomial coefficients w (lowest power first), shape (degree + 1,)."""
    X = polynomial_features(x, degree)
    y = np.asarray(y, dtype=np.float64).ravel()
    w, *_ = np.linalg.lstsq(X, y, rcond=None)
    return w


def bias_variance_estimate(degree, n_trials, n_train=20, noise=0.3, seed=0):
    """Estimates bias^2, variance and MSE of a degree-`degree` fit at fixed test points.

    Each trial draws n_train points in [0, 1], labels them with target(x) + Gaussian noise,
    fits a polynomial and predicts on a grid of 50 test points.
    Returns (bias2, variance, mse), where mse is measured against the noiseless target.
    bias2 + variance == mse holds exactly (ddof = 0 for the variance).
    """
    rng = np.random.default_rng(seed)
    x_test = np.linspace(0.0, 1.0, 50)
    X_test = polynomial_features(x_test, degree)
    preds = np.empty((n_trials, x_test.size))
    for t in range(n_trials):
        x = rng.uniform(0.0, 1.0, size=n_train)
        y = target(x) + noise * rng.normal(size=n_train)
        w = fit_poly(x, y, degree)
        preds[t] = X_test @ w

    truth = target(x_test)
    mean_pred = preds.mean(axis=0)
    bias2 = np.mean((mean_pred - truth) ** 2)
    variance = np.mean(preds.var(axis=0))
    mse = np.mean((preds - truth) ** 2)
    return float(bias2), float(variance), float(mse)
