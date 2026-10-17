"""Bagging of decision stumps and gradient boosting for regression: reference solution."""

import itertools

import numpy as np


def fit_stump(X, y):
    """Best regression stump by squared error.

    Returns the tuple (feature, threshold, left_value, right_value). A sample goes
    left when X[:, feature] <= threshold. Leaf values are the means of y in each leaf.
    Candidate thresholds are midpoints between consecutive unique values of a column.
    """
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    n = len(y)

    best_gain = -np.inf
    best = None
    for f in range(X.shape[1]):
        values = np.unique(X[:, f])
        for lo, hi in itertools.pairwise(values):
            t = (lo + hi) / 2
            left = X[:, f] <= t
            n_left = int(left.sum())
            n_right = n - n_left
            # Total squared error is sum(y^2) - gain, so maximizing gain minimizes the error.
            gain = y[left].sum() ** 2 / n_left + y[~left].sum() ** 2 / n_right
            if gain > best_gain:
                best_gain = gain
                best = (f, float(t))

    if best is None:
        # No split is possible (every column is constant): predict the mean everywhere.
        mean = float(y.mean())
        return (0, float("inf"), mean, mean)

    f, t = best
    left = X[:, f] <= t
    return (f, t, float(y[left].mean()), float(y[~left].mean()))


def predict_stump(stump, X):
    """Predictions of one stump for the rows of X, shape (n,)."""
    feature, threshold, left_value, right_value = stump
    X = np.asarray(X, dtype=np.float64)
    return np.where(X[:, feature] <= threshold, left_value, right_value)


def bagging_fit(X, y, n_estimators, seed=0):
    """Fits `n_estimators` stumps, each on a bootstrap sample of the rows of X."""
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    n = len(y)
    rng = np.random.default_rng(seed)
    stumps = []
    for _ in range(n_estimators):
        idx = rng.integers(0, n, size=n)
        stumps.append(fit_stump(X[idx], y[idx]))
    return stumps


def bagging_oob_predict(X, y, n_estimators, seed=0):
    """Out-of-bag predictions: row i is predicted only by stumps that did not see row i.

    Rows that are in every bootstrap sample get nan.
    """
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    n = len(y)
    rng = np.random.default_rng(seed)
    total = np.zeros(n)
    count = np.zeros(n)
    for _ in range(n_estimators):
        idx = rng.integers(0, n, size=n)
        stump = fit_stump(X[idx], y[idx])
        out = np.ones(n, dtype=bool)
        out[idx] = False
        total[out] += predict_stump(stump, X[out])
        count[out] += 1
    result = np.full(n, np.nan)
    seen = count > 0
    result[seen] = total[seen] / count[seen]
    return result


def bagging_predict(stumps, X):
    """Average of the predictions of all stumps, shape (n,)."""
    preds = np.stack([predict_stump(s, X) for s in stumps])
    return preds.mean(axis=0)


def gb_fit(X, y, n_estimators, learning_rate):
    """Gradient boosting with squared loss: each stump fits the current residuals.

    Returns a dict with the constant start `base`, the shrinkage `learning_rate`
    and the list of fitted `stumps`.
    """
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    base = float(y.mean())
    pred = np.full(len(y), base)
    stumps = []
    for _ in range(n_estimators):
        residual = y - pred
        stump = fit_stump(X, residual)
        stumps.append(stump)
        pred = pred + learning_rate * predict_stump(stump, X)
    return {"base": base, "learning_rate": float(learning_rate), "stumps": stumps}


def gb_predict(model, X):
    """Predictions of a model returned by `gb_fit`, shape (n,)."""
    X = np.asarray(X, dtype=np.float64)
    out = np.full(X.shape[0], model["base"])
    for stump in model["stumps"]:
        out = out + model["learning_rate"] * predict_stump(stump, X)
    return out
