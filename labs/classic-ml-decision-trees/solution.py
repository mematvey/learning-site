"""Decision tree for classification: reference solution."""

import numpy as np

CRITERIA = ("gini", "entropy")


def _check_criterion(criterion):
    if criterion not in CRITERIA:
        raise ValueError(f"unknown criterion {criterion!r}, expected one of {CRITERIA}")


def _impurity_from_counts(counts, criterion):
    """Impurity of nodes given class counts along the last axis."""
    sizes = counts.sum(axis=-1, keepdims=True)
    p = counts / sizes
    if criterion == "gini":
        return 1.0 - np.sum(p * p, axis=-1)
    # 0 * log 0 is taken as 0: replace zero probabilities by 1 inside the log.
    safe = np.where(p > 0, p, 1.0)
    return -np.sum(p * np.log(safe), axis=-1)


def impurity(y, criterion="gini"):
    """Impurity of the labels `y` (1-D, at least one element).

    "gini": 1 - sum_k p_k^2. "entropy": -sum_k p_k log p_k (natural log).
    Returns a float, 0.0 for a pure set of labels.
    """
    _check_criterion(criterion)
    y = np.asarray(y)
    if y.size == 0:
        raise ValueError("impurity of an empty label set is undefined")
    _, counts = np.unique(y, return_counts=True)
    return float(_impurity_from_counts(counts.astype(np.float64), criterion))


def best_split(X, y, criterion="gini"):
    """Best binary split of the node with features `X` (n, d) and labels `y` (n,).

    A split is a pair (feature j, threshold t): left part is X[:, j] <= t.
    Thresholds are midpoints between consecutive distinct sorted values.
    Returns (j, t, q), where q = n_L/n * I_L + n_R/n * I_R is the weighted
    impurity after the split, and the split with the smallest q wins.
    Ties are broken by the smaller feature index, then the smaller threshold.
    Returns None if no split separates two objects (n < 2 or constant X).
    """
    _check_criterion(criterion)
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y)
    n = X.shape[0]
    if n < 2:
        return None

    classes, codes = np.unique(y, return_inverse=True)
    onehot = np.eye(len(classes))[codes.ravel()]
    total = onehot.sum(axis=0)
    sizes_left = np.arange(1, n, dtype=np.float64)

    best = None
    for j in range(X.shape[1]):
        order = np.argsort(X[:, j], kind="stable")
        values = X[order, j]
        # left_counts[i] = class counts of the first i + 1 sorted objects
        left_counts = np.cumsum(onehot[order], axis=0)[:-1]
        right_counts = total - left_counts
        q = (
            sizes_left * _impurity_from_counts(left_counts, criterion)
            + (n - sizes_left) * _impurity_from_counts(right_counts, criterion)
        ) / n
        # a split between equal values does not separate anything
        q = np.where(values[1:] > values[:-1], q, np.inf)
        i = int(np.argmin(q))
        if np.isfinite(q[i]) and (best is None or q[i] < best[2]):
            threshold = (values[i] + values[i + 1]) / 2.0
            best = (j, float(threshold), float(q[i]))
    return best


def _grow(X, y, depth, max_depth, criterion):
    labels, counts = np.unique(y, return_counts=True)
    # ties in the majority vote go to the smallest label (np.argmax takes the first)
    majority = labels[np.argmax(counts)].item()
    if len(labels) == 1 or (max_depth is not None and depth >= max_depth):
        return {"label": majority}
    split = best_split(X, y, criterion)
    if split is None:
        return {"label": majority}
    j, t, _ = split
    mask = X[:, j] <= t
    return {
        "feature": j,
        "threshold": t,
        "left": _grow(X[mask], y[mask], depth + 1, max_depth, criterion),
        "right": _grow(X[~mask], y[~mask], depth + 1, max_depth, criterion),
    }


def build_tree(X, y, max_depth=None, criterion="gini"):
    """Grow a classification tree recursively, choosing `best_split` at every node.

    A node becomes a leaf when all its labels are equal, when it is at depth
    `max_depth` (root is depth 0; None means no limit), or when no split exists.
    Returns nested dicts: a leaf is {"label": c}; an inner node is
    {"feature": j, "threshold": t, "left": subtree, "right": subtree}.
    """
    _check_criterion(criterion)
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y)
    return _grow(X, y, 0, max_depth, criterion)


def predict(tree, X):
    """Labels for the rows of `X` by walking the tree from the root to a leaf."""
    X = np.asarray(X, dtype=np.float64)
    return np.array([_predict_one(tree, row) for row in X])


def _predict_one(node, row):
    while "label" not in node:
        go_left = row[node["feature"]] <= node["threshold"]
        node = node["left"] if go_left else node["right"]
    return node["label"]
