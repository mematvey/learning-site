"""Ridge regression and lasso on NumPy: reference solution.

Convention (same as the chapter): the objective is
    sum_i (y_i - x_i @ w)^2 + lam * P(w),
with P(w) = sum_j w_j^2 for ridge and P(w) = sum_j |w_j| for lasso.
Inputs are assumed centered (no intercept term).
"""

import numpy as np


def ridge_fit(X, y, lam):
    """Closed-form ridge weights: (X^T X + lam I)^-1 X^T y."""
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    d = X.shape[1]
    return np.linalg.solve(X.T @ X + lam * np.eye(d), X.T @ y)


def soft_threshold(z, t):
    """Element-wise soft-thresholding: sign(z) * max(|z| - t, 0)."""
    z = np.asarray(z, dtype=np.float64)
    return np.sign(z) * np.maximum(np.abs(z) - t, 0.0)


def lasso_cd(X, y, lam, n_iter=500):
    """Lasso weights by cyclic coordinate descent, starting from w = 0.

    Each coordinate update is w_j = soft_threshold(rho_j, lam / 2) / z_j,
    where rho_j = X_j^T r_j is computed on the residual without feature j.
    """
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    _, d = X.shape
    w = np.zeros(d)
    z = (X * X).sum(axis=0)
    for _ in range(n_iter):
        for j in range(d):
            if z[j] == 0.0:
                w[j] = 0.0
                continue
            # residual with the current contribution of feature j added back
            r = y - X @ w + X[:, j] * w[j]
            rho = X[:, j] @ r
            w[j] = soft_threshold(rho, lam / 2.0) / z[j]
    return w
