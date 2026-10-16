"""Bagging of decision stumps and gradient boosting for regression: starter code.

A stump is a depth-one regression tree stored as the tuple
(feature, threshold, left_value, right_value). A sample goes left when
X[:, feature] <= threshold. X is a 2-D float array of shape (n, d), y has shape (n,).

Complete every function marked with TODO so that it matches the chapter text.
"""


def fit_stump(X, y):
    """Best regression stump by squared error.

    Returns (feature, threshold, left_value, right_value). Leaf values are the means
    of y in each leaf. Try every feature and every threshold between consecutive
    unique values of that column. On ties keep the first feature and the smallest
    threshold. If no split is possible (all columns constant), return a stump that
    predicts the mean of y for every row.
    """
    # TODO: search over features and thresholds, keep the split with the smallest squared error
    raise NotImplementedError


def predict_stump(stump, X):
    """Predictions of one stump for the rows of X, shape (n,)."""
    # TODO: send each row left or right according to the stump, return the leaf value
    raise NotImplementedError


def bagging_fit(X, y, n_estimators, seed=0):
    """Fits `n_estimators` stumps, each on a bootstrap sample of the rows of X.

    A bootstrap sample has n rows drawn with replacement. Use one generator
    created with `np.random.default_rng(seed)` for all draws. Returns a list of stumps.
    """
    # TODO: draw bootstrap indices, fit a stump on each sample
    raise NotImplementedError


def bagging_predict(stumps, X):
    """Average of the predictions of all stumps, shape (n,)."""
    # TODO: average the predictions of the stumps
    raise NotImplementedError


def gb_fit(X, y, n_estimators, learning_rate):
    """Gradient boosting with squared loss.

    Start from the mean of y. On each step fit a stump to the residuals y - F and
    add learning_rate times its predictions to F. Returns a dict with keys
    "base" (the start value), "learning_rate" and "stumps".
    """
    # TODO: start from the mean, then repeat: residuals -> stump -> shrunken update
    raise NotImplementedError


def gb_predict(model, X):
    """Predictions of a model returned by `gb_fit`, shape (n,)."""
    # TODO: start from model["base"] and add the shrunken predictions of every stump
    raise NotImplementedError
