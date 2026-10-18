"""Gradient boosting on stumps with shrinkage and early stopping: reference solution."""

import itertools

import numpy as np


def fit_stump(X, y):
    """Best regression stump by squared error.

    Returns (feature, threshold, left_value, right_value). A sample goes left when
    X[:, feature] <= threshold. Leaf values are the means of y in each leaf.
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
    """Predictions of one stump for the rows of X, shape (n,)."""
    feature, threshold, left_value, right_value = stump
    X = np.asarray(X, dtype=np.float64)
    return np.where(X[:, feature] <= threshold, left_value, right_value)


def gb_fit(X_train, y_train, X_val, y_val, n_estimators, learning_rate, early_stopping_rounds):
    """Boosting with shrinkage; stops when validation MSE has not improved for a while.

    The model starts from mean(y_train). Each round fits a stump to the residuals of
    the training set and adds learning_rate times its predictions. Validation MSE is
    recorded after every round. Training stops early if `early_stopping_rounds` rounds
    in a row do not improve the best validation MSE (None disables early stopping).
    The returned stumps are cut back to the best round.
    """
    X_train = np.asarray(X_train, dtype=np.float64)
    y_train = np.asarray(y_train, dtype=np.float64)
    X_val = np.asarray(X_val, dtype=np.float64)
    y_val = np.asarray(y_val, dtype=np.float64)

    base = float(y_train.mean())
    pred_train = np.full(len(y_train), base)
    pred_val = np.full(len(y_val), base)
    best_val_mse = float(np.mean((pred_val - y_val) ** 2))
    best_iter = 0
    since_best = 0
    stumps = []
    val_mse = []

    for m in range(1, n_estimators + 1):
        stump = fit_stump(X_train, y_train - pred_train)
        stumps.append(stump)
        pred_train = pred_train + learning_rate * predict_stump(stump, X_train)
        pred_val = pred_val + learning_rate * predict_stump(stump, X_val)
        mse = float(np.mean((pred_val - y_val) ** 2))
        val_mse.append(mse)
        if mse < best_val_mse:
            best_val_mse = mse
            best_iter = m
            since_best = 0
        else:
            since_best += 1
        if early_stopping_rounds is not None and since_best >= early_stopping_rounds:
            break

    return {
        "base": base,
        "learning_rate": float(learning_rate),
        "stumps": stumps[:best_iter],
        "val_mse": val_mse,
        "best_iter": best_iter,
        "best_val_mse": best_val_mse,
        "stopped_at": len(val_mse),
    }


def gb_predict(model, X):
    """Predictions of a model returned by `gb_fit`, shape (n,)."""
    X = np.asarray(X, dtype=np.float64)
    out = np.full(X.shape[0], model["base"])
    for stump in model["stumps"]:
        out = out + model["learning_rate"] * predict_stump(stump, X)
    return out


def select_learning_rate(
    X_train, y_train, X_val, y_val, rates, n_estimators, early_stopping_rounds
):
    """Fits a model for every shrinkage in `rates` and returns the best one.

    Returns a dict with "learning_rate", "n_trees" (the best round of that model) and
    "val_mse" (its best validation MSE). On a tie the earlier rate in `rates` wins.
    """
    best = None
    for rate in rates:
        model = gb_fit(X_train, y_train, X_val, y_val, n_estimators, rate, early_stopping_rounds)
        if best is None or model["best_val_mse"] < best["val_mse"]:
            best = {
                "learning_rate": float(rate),
                "n_trees": model["best_iter"],
                "val_mse": model["best_val_mse"],
            }
    return best
