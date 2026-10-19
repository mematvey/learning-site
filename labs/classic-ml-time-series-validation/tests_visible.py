"""Visible tests. The functions and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def _pairs(splits):
    """Converts splits to plain lists of ints, so arrays and lists both work."""
    return [([int(i) for i in tr], [int(i) for i in te]) for tr, te in splits]


def test_expanding_example_from_text():
    # n=12, three splits, test size 2: test windows start at 6, 8, 10
    got = _pairs(expanding_splits(12, 3, 2))
    expected = [
        ([0, 1, 2, 3, 4, 5], [6, 7]),
        ([0, 1, 2, 3, 4, 5, 6, 7], [8, 9]),
        ([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [10, 11]),
    ]
    assert got == expected, f"expected {expected}, got {got}"


def test_sliding_example_from_text():
    # Same test windows, training window of fixed length 4 that moves forward
    got = _pairs(sliding_splits(12, 3, 2, 4))
    expected = [
        ([2, 3, 4, 5], [6, 7]),
        ([4, 5, 6, 7], [8, 9]),
        ([6, 7, 8, 9], [10, 11]),
    ]
    assert got == expected, f"expected {expected}, got {got}"


def test_gap_leaves_unused_points():
    # With gap=1 the point just before each test window is not used for training
    got = _pairs(expanding_splits(12, 3, 2, gap=1))
    expected = [
        ([0, 1, 2, 3, 4], [6, 7]),
        ([0, 1, 2, 3, 4, 5, 6], [8, 9]),
        ([0, 1, 2, 3, 4, 5, 6, 7, 8], [10, 11]),
    ]
    assert got == expected, f"expected {expected}, got {got}"


def test_training_is_always_before_test():
    for tr, te in _pairs(expanding_splits(12, 3, 2)) + _pairs(sliding_splits(12, 3, 2, 4)):
        assert max(tr) < min(te), f"training index {max(tr)} is not before test {min(te)}"


def test_lag_features_one_lag():
    y = [10, 12, 11, 15, 14, 16]
    X, target = lag_features(y, [1])
    X = np.asarray(X).tolist()
    target = np.asarray(target).tolist()
    # Rows start at the second day: lag of day 2 is 10, lag of day 6 is 14
    assert X == [[10], [12], [11], [15], [14]], f"unexpected X: {X}"
    assert target == [12, 11, 15, 14, 16], f"unexpected target: {target}"


def test_lag_features_two_lags_column_order():
    y = [10, 12, 11, 15, 14, 16]
    X, target = lag_features(y, [1, 2])
    X = np.asarray(X).tolist()
    target = np.asarray(target).tolist()
    expected_X = [[12, 10], [11, 12], [15, 11], [14, 15]]
    expected_t = [11, 15, 14, 16]
    assert X == expected_X, f"expected X {expected_X}, got {X}"
    assert target == expected_t, f"expected target {expected_t}, got {target}"
