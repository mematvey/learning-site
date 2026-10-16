"""Ridge regression and lasso on NumPy: starter code.

Complete the three functions so that they match the chapter text.
Convention: the objective is sum_i (y_i - x_i @ w)^2 + lam * P(w), where
P(w) = sum_j w_j^2 for ridge and P(w) = sum_j |w_j| for lasso.
Inputs are centered, so there is no intercept term.
"""

import numpy as np


def ridge_fit(X, y, lam):
    """Closed-form ridge weights for centered X (n x d) and y (n,)."""
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)

    # TODO: solve (X^T X + lam * I) w = X^T y and return w
    raise NotImplementedError


def soft_threshold(z, t):
    """Element-wise soft-thresholding: sign(z) * max(|z| - t, 0)."""
    z = np.asarray(z, dtype=np.float64)

    # TODO: shrink every value toward zero by t; values with |z| <= t become 0
    raise NotImplementedError


def lasso_cd(X, y, lam, n_iter=500):
    """Lasso weights by cyclic coordinate descent, starting from w = 0.

    Use the one-dimensional minimizer for each weight: soft-threshold the
    partial residual correlation with lam / 2, then divide by X_j^T X_j.
    Columns that are all zeros keep weight 0.
    """
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)

    # TODO: run n_iter passes over the weights and update each one in place
    raise NotImplementedError
