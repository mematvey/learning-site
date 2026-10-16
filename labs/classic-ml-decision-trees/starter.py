"""Decision tree for classification: starter code.

Complete `impurity`, `best_split` and `build_tree` so that they match the
chapter text. `predict` is already written and walks the tree you build.

Tree format: a leaf is {"label": c}; an inner node is
{"feature": j, "threshold": t, "left": subtree, "right": subtree}.
A split sends an object to the left part when X[:, j] <= t.
"""

import numpy as np

CRITERIA = ("gini", "entropy")


def impurity(y, criterion="gini"):
    """Impurity of the labels `y` (1-D, at least one element).

    "gini": 1 - sum_k p_k^2. "entropy": -sum_k p_k log p_k (natural log,
    0 log 0 = 0). Returns a float, 0.0 for a pure set of labels.
    Raise ValueError for an unknown criterion.
    """
    # TODO: count the classes in y, turn the counts into probabilities p_k,
    # then return the Gini index or the entropy depending on `criterion`.
    raise NotImplementedError


def best_split(X, y, criterion="gini"):
    """Best binary split of the node with features `X` (n, d) and labels `y` (n,).

    A split is a pair (feature j, threshold t): left part is X[:, j] <= t.
    Thresholds are midpoints between consecutive distinct sorted values.
    Returns (j, t, q), where q = n_L/n * I_L + n_R/n * I_R is the weighted
    impurity after the split, and the split with the smallest q wins.
    Ties are broken by the smaller feature index, then the smaller threshold.
    Returns None if no split separates two objects (n < 2 or constant X).
    """
    # TODO: for every feature, sort the objects by its value and sweep the
    # thresholds, keeping class counts of the left and right parts. Skip
    # positions where neighbouring values are equal. Keep the split with the
    # smallest weighted impurity q.
    raise NotImplementedError


def build_tree(X, y, max_depth=None, criterion="gini"):
    """Grow a classification tree recursively, choosing `best_split` at every node.

    A node becomes a leaf when all its labels are equal, when it is at depth
    `max_depth` (root is depth 0; None means no limit), or when no split exists.
    The leaf label is the majority class; on a tie take the smallest label.
    """
    # TODO: if the node is a leaf, return {"label": majority}. Otherwise split
    # with best_split, partition X and y by X[:, j] <= t, and recurse on both
    # parts with depth + 1.
    raise NotImplementedError


def predict(tree, X):
    """Labels for the rows of `X` by walking the tree from the root to a leaf."""
    X = np.asarray(X, dtype=np.float64)
    return np.array([_predict_one(tree, row) for row in X])


def _predict_one(node, row):
    while "label" not in node:
        go_left = row[node["feature"]] <= node["threshold"]
        node = node["left"] if go_left else node["right"]
    return node["label"]
