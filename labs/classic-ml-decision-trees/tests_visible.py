"""Visible tests. `impurity`, `best_split`, `build_tree`, `predict` and `assert_close`
come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import math

import numpy as np


def _depth(node):
    """Depth of a tree in edges: a leaf has depth 0."""
    if "label" in node:
        return 0
    return 1 + max(_depth(node["left"]), _depth(node["right"]))


def test_gini_and_entropy_hand_cases():
    # labels [0, 0, 1, 1]: Gini = 1 - 2 * (1/2)^2 = 0.5, entropy = ln 2
    g = impurity([0, 0, 1, 1], criterion="gini")
    h = impurity([0, 0, 1, 1], criterion="entropy")
    assert_close(g, 0.5, atol=1e-6, message=f"Gini of [0, 0, 1, 1]: expected 0.5, got {g}")
    assert_close(
        h, math.log(2), atol=1e-6, message=f"entropy of [0, 0, 1, 1]: expected ln 2, got {h}"
    )


def test_pure_node_has_zero_impurity():
    for criterion in ("gini", "entropy"):
        value = impurity([2, 2, 2], criterion=criterion)
        assert_close(
            value,
            0.0,
            atol=1e-9,
            message=f"pure node must have impurity 0 ({criterion}), got {value}",
        )


def test_best_split_on_one_feature():
    # Threshold 6.5 separates {1, 2, 3} from {10, 11}: both parts are pure, q = 0.
    X = [[1.0], [2.0], [3.0], [10.0], [11.0]]
    y = [0, 0, 0, 1, 1]
    split = best_split(X, y, criterion="gini")
    assert split is not None, "expected a split, got None"
    j, t, q = split
    assert j == 0, f"expected feature 0, got {j}"
    assert_close(t, 6.5, atol=1e-9, message=f"expected threshold 6.5, got {t}")
    assert_close(q, 0.0, atol=1e-9, message=f"both parts are pure, expected q = 0, got {q}")


def test_best_split_picks_informative_feature():
    # Feature 0 alternates between classes; feature 1 separates them exactly at 1.5.
    X = [[0.3, 1.0], [0.1, 2.0], [0.9, 1.0], [0.7, 2.0]]
    y = [0, 1, 0, 1]
    split = best_split(X, y, criterion="gini")
    assert split is not None, "expected a split, got None"
    j, t, _ = split
    assert j == 1, f"expected feature 1 (the separating one), got {j}"
    assert_close(t, 1.5, atol=1e-9, message=f"expected threshold 1.5, got {t}")


def test_pure_node_becomes_leaf():
    tree = build_tree([[1.0], [2.0], [3.0]], [1, 1, 1])
    assert tree == {"label": 1}, f"a pure node must be a leaf {{'label': 1}}, got {tree}"


def test_tree_fits_separable_data():
    X = [[1.0], [2.0], [3.0], [10.0], [11.0], [12.0]]
    y = [0, 0, 0, 1, 1, 1]
    tree = build_tree(X, y)
    pred = predict(tree, X)
    assert np.array_equal(pred, np.array(y)), f"expected {y}, got {pred.tolist()}"


def test_max_depth_one_is_a_stump():
    X = [[float(i)] for i in range(1, 9)]
    y = [0, 1, 0, 1, 0, 1, 0, 1]
    tree = build_tree(X, y, max_depth=1)
    assert _depth(tree) == 1, f"max_depth=1 must give depth 1, got {_depth(tree)}"
