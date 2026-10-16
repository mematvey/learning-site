"""Bias-variance decomposition with polynomial regression: starter code.

Complete the three functions marked TODO so that they match the chapter text.
`target` is given and must not be changed.
"""

import numpy as np


def target(x):
    """True function of the experiment."""
    return np.sin(2 * np.pi * x)


def polynomial_features(x, degree):
    """Polynomial design matrix.

    x: 1-D array of n points. Returns an (n, degree + 1) array whose column k holds x**k.
    """
    # TODO: build the columns x**0 ... x**degree and stack them
    raise NotImplementedError


def fit_poly(x, y, degree):
    """Least-squares polynomial coefficients w (lowest power first), shape (degree + 1,)."""
    # TODO: fit w on polynomial_features(x, degree) by least squares
    raise NotImplementedError


def bias_variance_estimate(degree, n_trials, n_train=20, noise=0.3, seed=0):
    """Estimates bias^2, variance and MSE of a degree-`degree` fit at fixed test points.

    Use np.random.default_rng(seed). Each trial draws n_train points in [0, 1] and labels
    them with target(x) + Gaussian noise. Test points: np.linspace(0, 1, 50).
    Returns (bias2, variance, mse) with mse measured against the noiseless target.
    """
    # TODO: run n_trials fits, collect predictions on the test points, then compute
    # bias2 from the mean prediction, variance across trials, and mse against target
    raise NotImplementedError
