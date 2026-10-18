"""Visible tests. The functions from starter.py (or solution.py) and `assert_close` come from the runner."""

# ruff: noqa: F821
import numpy as np


def test_impute_median_uses_training_median():
    X_train = np.array([[1.0], [np.nan], [3.0], [5.0]])
    X_test = np.array([[np.nan], [100.0]])
    tr, te = impute_median(X_train, X_test)
    assert_close(
        tr, [[1.0], [3.0], [3.0], [5.0]], message="train NaN must become the train median 3"
    )
    assert_close(
        te, [[3.0], [100.0]], message="test NaN must use the training median, not test values"
    )


def test_standardize_uses_training_mean_and_std():
    # train mean 2, population std sqrt(8/3)
    X_train = np.array([[0.0], [2.0], [4.0]])
    X_test = np.array([[2.0], [6.0]])
    s = np.sqrt(8.0 / 3.0)
    tr, te = standardize(X_train, X_test)
    assert_close(
        tr[:, 0], [-2.0 / s, 0.0, 2.0 / s], message="train part must be centered and scaled"
    )
    assert_close(te[:, 0], [0.0, 4.0 / s], message="test part must use the training mean and std")


def test_one_hot_unseen_category_is_zero_row():
    tr, te = one_hot(["a", "b", "a"], ["b", "c"])
    assert_close(
        tr, [[1, 0], [0, 1], [1, 0]], message="columns must be the sorted training categories"
    )
    assert_close(te, [[0, 1], [0, 0]], message="unseen category 'c' must give a zero row")


def test_smooth_mean_hand_case():
    # (2 + 3 * 0.2) / (3 + 3)
    value = smooth_mean(2.0, 3, 0.2, 3.0)
    assert_close(value, 2.6 / 6.0, atol=1e-9, message=f"expected {2.6 / 6.0}, got {value}")


def test_target_encode_hand_case():
    # prior = 0.5; A: (2 + 0.5) / (3 + 1); B: (0 + 0.5) / (1 + 1); C is unseen
    c_train = ["A", "A", "A", "B"]
    y_train = [1, 1, 0, 0]
    enc = target_encode(c_train, y_train, ["A", "B", "C"], 1.0)
    assert_close(
        enc, [0.625, 0.25, 0.5], message=f"expected [0.625, 0.25, 0.5], got {enc.tolist()}"
    )


def test_prepare_features_shape_and_unseen_one_hot():
    num_train = np.array([[1.0, np.nan], [2.0, 4.0], [3.0, 6.0], [4.0, 8.0]])
    num_test = np.array([[2.5, 5.0], [np.nan, 1.0]])
    oh_train = ["x", "y", "x", "z"]
    oh_test = ["y", "w"]
    te_train = ["p", "p", "q", "q"]
    te_test = ["p", "r"]
    y_train = [1, 0, 1, 1]
    folds = [0, 1, 0, 1]
    X_train, X_test = prepare_features(
        num_train, num_test, oh_train, oh_test, te_train, te_test, y_train, folds, 1.0
    )
    assert X_train.shape == (4, 2 + 3 + 1), f"expected train shape (4, 6), got {X_train.shape}"
    assert X_test.shape == (2, 2 + 3 + 1), f"expected test shape (2, 6), got {X_test.shape}"
    assert_close(
        X_test[1, 2:5], [0.0, 0.0, 0.0], message="unseen one-hot category must be a zero block"
    )
