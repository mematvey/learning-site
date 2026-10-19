"""Gradient boosting on stumps with shrinkage and early stopping: starter code.

A stump is a depth-one regression tree stored as the tuple
(feature, threshold, left_value, right_value). A sample goes left when
X[:, feature] <= threshold. X is a 2-D float array of shape (n, d), y has shape (n,).

`fit_stump` and `predict_stump` are given. Complete every function marked with TODO
so that it matches the chapter text: learning_rate is the shrinkage, n_estimators is
the maximum number of trees, early_stopping_rounds is the patience on validation.
"""

import itertools

import numpy as np


def fit_stump(X, y):
    """Best regression stump by squared error (given).

    Returns (feature, threshold, left_value, right_value). Leaf values are the means
    of y in each leaf. Ties keep the first feature and the smallest threshold.
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
            gain = y[left].sum() ** 2 / n_left + y[~left].sum() ** 2 / n_right
            if gain > best_gain:
                best_gain = gain
                best = (f, float(t))

    if best is None:
        mean = float(y.mean())
        return (0, float("inf"), mean, mean)

    f, t = best
    left = X[:, f] <= t
    return (f, t, float(y[left].mean()), float(y[~left].mean()))


def predict_stump(stump, X):
    """Predictions of one stump for the rows of X, shape (n,) (given)."""
    feature, threshold, left_value, right_value = stump
    X = np.asarray(X, dtype=np.float64)
    return np.where(X[:, feature] <= threshold, left_value, right_value)


def gb_fit(X_train, y_train, X_val, y_val, n_estimators, learning_rate, early_stopping_rounds):
    """Boosting with shrinkage; stops when validation MSE has not improved for a while.

    The model starts from mean(y_train). Each round fits a stump to the residuals of
    the training set and adds learning_rate times its predictions. Validation MSE is
    recorded after every round, and the start (no trees) counts as round 0. Training
    stops early once `early_stopping_rounds` rounds in a row do not beat the best
    validation MSE so far (None disables early stopping). The returned stumps are cut
    back to the best round.

    Returns a dict with keys:
      "base": start value, "learning_rate": float, "stumps": list of kept stumps,
      "val_mse": validation MSE after every round that was run,
      "best_iter": number of kept trees, "best_val_mse": best validation MSE,
      "stopped_at": number of rounds that were run.
    """
    # TODO: start from mean(y_train), then repeat: residuals -> stump -> shrunken update,
    # track validation MSE and stop by the patience rule
    raise NotImplementedError


def gb_predict(model, X):
    """Predictions of a model returned by `gb_fit`, shape (n,)."""
    # TODO: start from model["base"] and add learning_rate times the prediction of every stump
    raise NotImplementedError


def select_learning_rate(
    X_train, y_train, X_val, y_val, rates, n_estimators, early_stopping_rounds
):
    """Fits a model for every shrinkage in `rates` and returns the best one.

    Returns a dict with "learning_rate", "n_trees" (the best round of that model) and
    "val_mse" (its best validation MSE). On a tie the earlier rate in `rates` wins.
    """
    # TODO: call gb_fit for each rate with the same settings, keep the lowest best_val_mse
    raise NotImplementedError
