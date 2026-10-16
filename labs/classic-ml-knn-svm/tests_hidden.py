"""Hidden tests: reference comparison, scale, exact matches, edge cases.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import math

import numpy as np


def _reference(X_train, y_train, X_test, k, weights):
    """Pure-Python kNN: sort by (distance, index), vote, ties to the smaller label."""
    out = []
    for x in X_test:
        ranked = sorted((math.dist(x, xi), i) for i, xi in enumerate(X_train))
        nb = ranked[:k]
        if weights == "distance" and any(d == 0 for d, _ in nb):
            nb = [(d, i) for d, i in nb if d == 0]
        votes = {}
        for d, i in nb:
            w = 1.0 if weights == "uniform" else (1.0 / d if d > 0 else 1.0)
            votes[y_train[i]] = votes.get(y_train[i], 0.0) + w
        best = max(votes.items(), key=lambda kv: (kv[1], -kv[0]))
        out.append(best[0])
    return out


def test_hidden_random_matches_reference():
    rng = np.random.default_rng(0)
    X_train = rng.normal(size=(40, 2))
    y_train = rng.integers(0, 3, size=40)
    X_test = rng.normal(size=(15, 2))
    for weights in ("uniform", "distance"):
        pred = knn_predict(X_train, y_train, X_test, k=5, weights=weights)
        expected = _reference(X_train.tolist(), y_train.tolist(), X_test.tolist(), 5, weights)
        assert pred.tolist() == expected, f"mismatch on random input, seed 0 ({weights})"


def test_hidden_scale_invariance():
    rng = np.random.default_rng(1)
    X_train = rng.normal(size=(30, 3))
    y_train = rng.integers(0, 2, size=30)
    X_test = rng.normal(size=(10, 3))
    for weights in ("uniform", "distance"):
        base = knn_predict(X_train, y_train, X_test, k=3, weights=weights).tolist()
        for scale in (1000.0, 0.001):
            pred = knn_predict(X_train * scale, y_train, X_test * scale, k=3, weights=weights)
            assert pred.tolist() == base, f"scaling features changed predictions ({weights})"


def test_hidden_zero_distance_tie_goes_to_smaller_label():
    # Two training rows coincide with the query: labels 2 and 1 each get weight 1.
    X_train = np.array([[0.0, 0.0], [0.0, 0.0], [1.0, 1.0]])
    y_train = np.array([2, 1, 0])
    pred = knn_predict(X_train, y_train, np.array([[0.0, 0.0]]), k=3, weights="distance")
    assert pred.tolist() == [1], "zero-distance tie must be broken by the smaller label"


def test_hidden_string_labels_and_k_larger_than_n():
    X_train = np.array([[0.0], [4.0]])
    y_train = np.array(["cat", "dog"])
    pred = knn_predict(X_train, y_train, np.array([[1.0], [3.5]]), k=10, weights="distance")
    assert pred.tolist() == ["cat", "dog"], "string labels with k larger than n failed"


def test_hidden_single_training_point():
    pred = knn_predict(np.array([[2.0, 2.0]]), np.array([7]), np.zeros((3, 2)), k=1)
    assert pred.tolist() == [7, 7, 7], "one training point must label every query"


def test_hidden_inputs_not_mutated():
    rng = np.random.default_rng(2)
    X_train = rng.normal(size=(8, 2))
    y_train = rng.integers(0, 2, size=8)
    X_test = rng.normal(size=(4, 2))
    X_copy, y_copy, T_copy = X_train.copy(), y_train.copy(), X_test.copy()
    knn_predict(X_train, y_train, X_test, k=3, weights="distance")
    assert np.array_equal(X_train, X_copy), "X_train must not be modified"
    assert np.array_equal(y_train, y_copy), "y_train must not be modified"
    assert np.array_equal(X_test, T_copy), "X_test must not be modified"
