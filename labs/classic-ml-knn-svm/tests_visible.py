"""Visible tests. `knn_predict` and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
Training points on a line: x = 0, 1, 3, 10 with labels 0, 0, 1, 1.
"""

# ruff: noqa: F821
import numpy as np

X_TRAIN = np.array([[0.0], [1.0], [3.0], [10.0]])
Y_TRAIN = np.array([0, 0, 1, 1])


def test_output_shape():
    pred = knn_predict(X_TRAIN, Y_TRAIN, np.array([[0.5], [2.0], [9.0]]), k=1)
    assert pred.shape == (3,), f"expected output shape (3,), got {pred.shape}"


def test_k1_returns_nearest_label():
    # 0.4 is nearest to x=0 (label 0); 2.6 to x=3 (label 1); 9.0 to x=10 (label 1)
    pred = knn_predict(X_TRAIN, Y_TRAIN, np.array([[0.4], [2.6], [9.0]]), k=1)
    expected = [0, 1, 1]
    assert pred.tolist() == expected, f"expected {expected}, got {pred.tolist()}"


def test_uniform_majority_vote():
    # For x = 2.4 the 3 nearest are x=3 (label 1), x=1 (label 0), x=0 (label 0): majority 0
    pred = knn_predict(X_TRAIN, Y_TRAIN, np.array([[2.4]]), k=3, weights="uniform")
    assert pred.tolist() == [0], f"expected [0], got {pred.tolist()}"


def test_distance_weights_change_the_vote():
    # Same 3 neighbours, but the close x=3 gets weight 1/0.6 = 1.67 and beats
    # the two far label-0 neighbours with 1/1.4 + 1/2.4 = 1.13 in total.
    pred = knn_predict(X_TRAIN, Y_TRAIN, np.array([[2.4]]), k=3, weights="distance")
    assert pred.tolist() == [1], f"expected [1], got {pred.tolist()}"


def test_exact_match_decides_with_distance_weights():
    # x = 3.0 coincides with a training point of label 1. Uniform voting over k=3
    # gives label 0 (two neighbours), but distance weighting must return the exact match.
    uniform = knn_predict(X_TRAIN, Y_TRAIN, np.array([[3.0]]), k=3, weights="uniform")
    assert uniform.tolist() == [0], f"uniform: expected [0], got {uniform.tolist()}"
    pred = knn_predict(X_TRAIN, Y_TRAIN, np.array([[3.0]]), k=3, weights="distance")
    assert pred.tolist() == [1], f"distance: expected [1], got {pred.tolist()}"


def test_svm_predict_signs_and_zero_is_positive():
    X = np.array([[1.0, 0.0], [2.0, 0.0], [0.0, 5.0]])
    # f = x1 - 1: f(1,0) = 0 -> +1, f(2,0) = 1 -> +1, f(0,5) = -1 -> -1
    pred = svm_predict(X, np.array([1.0, 0.0]), -1.0)
    assert pred.tolist() == [1, 1, -1], f"expected [1, 1, -1], got {pred.tolist()}"


def test_svm_margin_width_is_two_over_norm():
    # ||(3, 4)|| = 5, so the full margin width is 2 / 5 = 0.4
    assert_close(
        svm_margin_width(np.array([3.0, 4.0])), 0.4, atol=1e-12, message="width of w=(3,4)"
    )


def test_svm_feasible_checks_the_margin_edges():
    X = np.array([[0.0], [2.0]])
    y = np.array([-1, 1])
    # f = x - 1 gives y*f = 1 and 1: both points sit exactly on the margin edges
    assert svm_is_feasible(X, y, np.array([1.0]), -1.0), "points on the edges are feasible"
    # f = 0.5 x - 1 gives y*f = 1 and 0: the second point is inside the margin
    assert not svm_is_feasible(X, y, np.array([0.5]), -1.0), (
        "a point inside the margin is not feasible"
    )
