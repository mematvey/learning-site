"""Hidden tests: edge cases, determinism and scale.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def test_hidden_stump_uses_informative_feature():
    rng = np.random.default_rng(10)
    X = rng.normal(size=(40, 2))
    y = np.where(X[:, 1] > 0, 2.0, -1.0)
    pred = predict_stump(fit_stump(X, y), X)
    assert_close(pred, y, atol=1e-6, message="mismatch on random input, seed 10")


def test_hidden_stump_uneven_values():
    X = np.array([[0.0], [1.0], [2.0], [3.0], [10.0]])
    y = np.array([1.0, 1.0, 5.0, 5.0, 5.0])
    pred = predict_stump(fit_stump(X, y), X)
    assert_close(pred, y, atol=1e-6, message="mismatch on uneven input")


def test_hidden_constant_columns_predict_mean():
    X = np.ones((5, 2))
    y = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
    pred = predict_stump(fit_stump(X, y), X)
    assert_close(
        pred, np.full(5, 3.0), atol=1e-6, message="no valid split: prediction must be the mean of y"
    )


def test_hidden_bagging_is_mean_of_its_stumps():
    rng = np.random.default_rng(11)
    X = rng.normal(size=(50, 3))
    y = X[:, 2] + rng.normal(size=50) * 0.2
    stumps = bagging_fit(X, y, n_estimators=9, seed=5)
    manual = np.mean([predict_stump(s, X) for s in stumps], axis=0)
    assert_close(
        bagging_predict(stumps, X),
        manual,
        atol=1e-9,
        message="bagging prediction must be the mean of stump predictions",
    )


def test_hidden_bagging_is_deterministic_for_seed():
    rng = np.random.default_rng(12)
    X = rng.normal(size=(40, 2))
    y = X[:, 0] - X[:, 1]
    a = bagging_predict(bagging_fit(X, y, n_estimators=6, seed=3), X)
    b = bagging_predict(bagging_fit(X, y, n_estimators=6, seed=3), X)
    assert_close(a, b, atol=0.0, message="same seed must give the same predictions")


def test_hidden_oob_single_estimator_leaves_nan_for_in_bag_rows():
    rng = np.random.default_rng(15)
    X = rng.normal(size=(30, 2))
    y = X[:, 0]
    oob = bagging_oob_predict(X, y, n_estimators=1, seed=1)
    idx = np.random.default_rng(1).integers(0, 30, size=30)
    in_bag = np.zeros(30, dtype=bool)
    in_bag[idx] = True
    assert np.array_equal(np.isnan(oob), in_bag), "rows in the only bag must be nan, others not"
    stump = bagging_fit(X, y, n_estimators=1, seed=1)[0]
    assert_close(
        oob[~in_bag],
        predict_stump(stump, X[~in_bag]),
        atol=1e-9,
        message="mismatch on out-of-bag rows",
    )


def test_hidden_oob_error_is_worse_than_training_error():
    rng = np.random.default_rng(16)
    X = rng.normal(size=(120, 3))
    y = X[:, 0] + rng.normal(size=120)
    stumps = bagging_fit(X, y, n_estimators=40, seed=2)
    train_mse = float(np.mean((bagging_predict(stumps, X) - y) ** 2))
    oob = bagging_oob_predict(X, y, n_estimators=40, seed=2)
    ok = ~np.isnan(oob)
    oob_mse = float(np.mean((oob[ok] - y[ok]) ** 2))
    assert oob_mse > train_mse, "out-of-bag error must be above the training error"


def test_hidden_gb_zero_steps_is_constant_mean():
    X = np.array([[0.0], [1.0], [2.0]])
    y = np.array([2.0, 4.0, 9.0])
    pred = gb_predict(gb_fit(X, y, n_estimators=0, learning_rate=0.5), X)
    assert_close(
        pred,
        np.full(3, 5.0),
        atol=1e-9,
        message="without steps the prediction must be the mean of y",
    )


def test_hidden_gb_training_error_never_increases():
    rng = np.random.default_rng(13)
    X = rng.uniform(-1, 1, size=(80, 2))
    y = X[:, 0] ** 2 + 0.5 * X[:, 1]
    prev = np.inf
    for m in range(1, 12):
        pred = gb_predict(gb_fit(X, y, n_estimators=m, learning_rate=0.4), X)
        mse = float(np.mean((pred - y) ** 2))
        assert mse <= prev + 1e-12, f"training MSE increased at step {m}"
        prev = mse


def test_hidden_gb_scale_reduces_variance_by_half():
    rng = np.random.default_rng(14)
    X = rng.normal(size=(300, 4))
    y = 2.0 * X[:, 0] - X[:, 1] + 0.1 * rng.normal(size=300)
    pred = gb_predict(gb_fit(X, y, n_estimators=40, learning_rate=0.1), X)
    mse = float(np.mean((pred - y) ** 2))
    assert mse < 0.5 * float(np.var(y)), "mismatch on random input, seed 14"
