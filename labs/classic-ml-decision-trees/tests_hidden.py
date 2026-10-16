"""Hidden tests: brute-force comparison, edge cases, depth limit and scale.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import itertools
import math
from collections import Counter

import numpy as np


def _depth(node):
    if "label" in node:
        return 0
    return 1 + max(_depth(node["left"]), _depth(node["right"]))


def _imp(labels, criterion):
    n = len(labels)
    probs = [c / n for c in Counter(labels).values()]
    if criterion == "gini":
        return 1.0 - sum(p * p for p in probs)
    return -sum(p * math.log(p) for p in probs)


def _brute_q(column, y, t, criterion):
    """Weighted impurity of the split column <= t, computed object by object."""
    left = [yy for xx, yy in zip(column, y) if xx <= t]
    right = [yy for xx, yy in zip(column, y) if xx > t]
    n = len(y)
    return (len(left) * _imp(left, criterion) + len(right) * _imp(right, criterion)) / n


def _brute_best(X, y, criterion):
    """Minimal weighted impurity over all features and all midpoint thresholds."""
    best = None
    for j in range(X.shape[1]):
        values = sorted(set(X[:, j].tolist()))
        for a, b in itertools.pairwise(values):
            q = _brute_q(X[:, j].tolist(), y.tolist(), (a + b) / 2.0, criterion)
            if best is None or q < best:
                best = q
    return best


def test_hidden_best_split_is_minimal():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(30, 3))
    y = rng.integers(0, 3, size=30)
    for criterion in ("gini", "entropy"):
        split = best_split(X, y, criterion=criterion)
        assert split is not None, f"no split returned ({criterion})"
        j, t, q = split
        assert_close(
            q,
            _brute_best(X, y, criterion),
            atol=1e-6,
            message=f"best_split did not find the minimal weighted impurity ({criterion})",
        )
        assert_close(
            q,
            _brute_q(X[:, j].tolist(), y.tolist(), t, criterion),
            atol=1e-6,
            message=f"reported q does not match the returned split ({criterion})",
        )


def test_hidden_split_threshold_is_midpoint():
    split = best_split([[1.0], [3.0]], [0, 1])
    assert split is not None, "two different values must give a split"
    j, t, _ = split
    assert j == 0, f"expected feature 0, got {j}"
    assert_close(t, 2.0, atol=1e-9, message=f"threshold must be the midpoint, got {t}")


def test_hidden_no_split_when_nothing_separates():
    assert best_split(np.ones((5, 2)), [0, 1, 0, 1, 1]) is None, (
        "constant features must give no split"
    )
    assert best_split([[1.0]], [0]) is None, "one object must give no split"


def test_hidden_impurity_limits():
    assert_close(
        impurity([0, 1, 2, 3], criterion="entropy"),
        math.log(4),
        atol=1e-6,
        message="uniform entropy over 4 classes must be ln 4",
    )
    assert_close(
        impurity([0, 1, 2, 3], criterion="gini"),
        0.75,
        atol=1e-6,
        message="uniform Gini over 4 classes must be 1 - 1/4",
    )
    assert_close(
        impurity([7], criterion="entropy"),
        0.0,
        atol=1e-9,
        message="a single object must have zero entropy",
    )


def test_hidden_unknown_criterion_raises():
    raised = False
    try:
        impurity([0, 1], criterion="error")
    except ValueError:
        raised = True
    assert raised, "unknown criterion must raise ValueError"


def test_hidden_tree_memorizes_distinct_points():
    rng = np.random.default_rng(1)
    X = rng.normal(size=(40, 2))
    y = rng.integers(0, 2, size=40)
    for criterion in ("gini", "entropy"):
        tree = build_tree(X, y, criterion=criterion)
        assert np.array_equal(predict(tree, X), y), (
            f"unlimited tree must fit distinct training points ({criterion})"
        )


def test_hidden_max_depth_is_respected():
    rng = np.random.default_rng(2)
    X = rng.normal(size=(50, 3))
    y = rng.integers(0, 3, size=50)
    for d in (0, 1, 2, 3):
        tree = build_tree(X, y, max_depth=d)
        assert _depth(tree) <= d, f"depth {_depth(tree)} exceeds max_depth={d}"
    root_only = build_tree(X, y, max_depth=0)
    assert "label" in root_only, "max_depth=0 must give a single leaf"


def test_hidden_tie_in_leaf_takes_smallest_label():
    X = [[1.0], [1.0], [1.0], [1.0]]
    y = [2, 5, 2, 5]
    tree = build_tree(X, y)
    assert tree == {"label": 2}, f"tie must go to the smallest label, got {tree}"


def test_hidden_scale_invariance():
    rng = np.random.default_rng(3)
    X = rng.normal(size=(60, 2))
    y = (X[:, 0] + X[:, 1] > 0).astype(int)
    base = predict(build_tree(X, y, max_depth=4), X)
    scaled = predict(build_tree(X * 1000.0 + 7.0, y, max_depth=4), X * 1000.0 + 7.0)
    assert np.array_equal(base, scaled), (
        "a monotone rescaling of features must not change predictions"
    )


def test_hidden_inputs_not_mutated():
    rng = np.random.default_rng(4)
    X = rng.normal(size=(12, 2))
    y = rng.integers(0, 2, size=12)
    X_copy, y_copy = X.copy(), y.copy()
    best_split(X, y, criterion="entropy")
    build_tree(X, y)
    assert np.array_equal(X, X_copy), "X must not be modified"
    assert np.array_equal(y, y_copy), "y must not be modified"
