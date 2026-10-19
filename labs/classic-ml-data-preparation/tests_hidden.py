"""Hidden tests: exact values, leakage checks and edge cases.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def _oof_reference(c, y, folds, m):
    """Plain-Python out-of-fold smoothed target encoding."""
    out = []
    for i in range(len(c)):
        others = [j for j in range(len(c)) if folds[j] != folds[i]]
        prior = sum(y[j] for j in others) / len(others)
        same = [j for j in others if c[j] == c[i]]
        n = len(same)
        s = sum(y[j] for j in same)
        out.append((s + m * prior) / (n + m) if n + m > 0 else prior)
    return np.array(out)


def _make_split(seed, n_train, n_test, num_cols=3):
    rng = np.random.default_rng(seed)
    num_tr = rng.normal(size=(n_train, num_cols))
    num_tr[rng.random((n_train, num_cols)) < 0.15] = np.nan
    num_te = rng.normal(size=(n_test, num_cols))
    num_te[rng.random((n_test, num_cols)) < 0.15] = np.nan
    oh_tr = rng.integers(0, 4, size=n_train)
    oh_te = rng.integers(0, 5, size=n_test)  # 4 is unseen in training
    te_tr = rng.integers(0, 12, size=n_train)
    te_te = rng.integers(0, 14, size=n_test)
    y_tr = rng.integers(0, 2, size=n_train)
    folds = rng.integers(0, 4, size=n_train)
    return num_tr, num_te, oh_tr, oh_te, te_tr, te_te, y_tr, folds


def test_hidden_oof_matches_reference():
    rng = np.random.default_rng(0)
    c = rng.integers(0, 6, size=40).tolist()
    y = rng.integers(0, 2, size=40).tolist()
    folds = rng.integers(0, 4, size=40).tolist()
    got = target_encode_oof(c, y, folds, 2.0)
    assert_close(
        got,
        _oof_reference(c, y, folds, 2.0),
        atol=1e-9,
        message="out-of-fold encoding mismatch, seed 0",
    )


def test_hidden_oof_row_ignores_its_own_label():
    rng = np.random.default_rng(1)
    c = rng.integers(0, 5, size=30)
    y = rng.integers(0, 2, size=30)
    folds = rng.integers(0, 3, size=30)
    base = target_encode_oof(c, y, folds, 1.0)
    for i in range(len(y)):
        flipped = y.copy()
        flipped[i] = 1 - flipped[i]
        after = target_encode_oof(c, flipped, folds, 1.0)
        assert_close(
            after[i],
            base[i],
            atol=1e-12,
            message="a row's out-of-fold encoding must not depend on its own label",
        )


def test_hidden_prepare_train_row_ignores_its_own_label():
    num_tr, num_te, oh_tr, oh_te, te_tr, te_te, y_tr, folds = _make_split(4, 40, 10)
    base, _ = prepare_features(num_tr, num_te, oh_tr, oh_te, te_tr, te_te, y_tr, folds, 1.0)
    for i in range(len(y_tr)):
        flipped = y_tr.copy()
        flipped[i] = 1 - flipped[i]
        after, _ = prepare_features(num_tr, num_te, oh_tr, oh_te, te_tr, te_te, flipped, folds, 1.0)
        assert_close(
            after[i, -1],
            base[i, -1],
            atol=1e-12,
            message="a training row's target feature must not depend on its own label",
        )


def test_hidden_prepare_train_feature_on_noise_not_inflated():
    rng = np.random.default_rng(5)
    n_tr, levels = 400, 300
    num_tr = rng.normal(size=(n_tr, 1))
    c_tr = rng.integers(0, levels, size=n_tr)
    y_tr = rng.integers(0, 2, size=n_tr)
    folds = rng.integers(0, 5, size=n_tr)
    X_tr, _ = prepare_features(
        num_tr, num_tr[:1], ["a"] * n_tr, ["a"], c_tr, c_tr[:1], y_tr, folds, 1.0
    )
    acc = float(np.mean((X_tr[:, -1] > 0.5) == (y_tr == 1)))
    assert acc < 0.62, "training feature on pure noise must not predict the labels"


def test_hidden_test_rows_do_not_leak_into_train_features():
    num_tr, num_te, oh_tr, oh_te, te_tr, te_te, y_tr, folds = _make_split(2, 50, 20)
    X_tr_a, _ = prepare_features(num_tr, num_te, oh_tr, oh_te, te_tr, te_te, y_tr, folds, 2.0)
    # Same train part; test part replaced by values of a different scale and new categories.
    num_te_b = num_te * 1000.0 + 50.0
    oh_te_b = np.full(len(oh_te), 3)
    te_te_b = np.full(len(te_te), 7)
    X_tr_b, _X_te_b = prepare_features(
        num_tr, num_te_b, oh_tr, oh_te_b, te_tr, te_te_b, y_tr, folds, 2.0
    )
    assert_close(
        X_tr_a,
        X_tr_b,
        atol=1e-12,
        message="changing test rows must not change the training features",
    )


def test_hidden_test_part_uses_training_statistics():
    num_tr, num_te, oh_tr, oh_te, te_tr, te_te, y_tr, folds = _make_split(3, 60, 25)
    _X_tr, X_te = prepare_features(num_tr, num_te, oh_tr, oh_te, te_tr, te_te, y_tr, folds, 1.0)
    # Numeric block: the expected test values use the mean and std of the training part.
    med = np.nanmedian(num_tr, axis=0)
    filled_tr = np.where(np.isnan(num_tr), med, num_tr)
    filled_te = np.where(np.isnan(num_te), med, num_te)
    mu = filled_tr.mean(axis=0)
    sd = filled_tr.std(axis=0)
    assert_close(
        X_te[:, :3],
        (filled_te - mu) / sd,
        atol=1e-9,
        message="numeric test block must use training median, mean and std",
    )
    # Target block: the test value of a seen category is the training-only smoothed mean.
    prior = float(np.mean(y_tr))
    for j in range(len(te_te)):
        val = te_te[j]
        mask = te_tr == val
        expect = (np.sum(y_tr[mask]) + 1.0 * prior) / (np.sum(mask) + 1.0)
        assert_close(
            X_te[j, -1],
            expect,
            atol=1e-9,
            message="test target encoding must use training statistics only",
        )


def test_hidden_noise_honest_score_is_not_inflated():
    # Pure noise: labels independent of every feature. A leaky encoding scores well, an honest one does not.
    rng = np.random.default_rng(0)
    n_tr, n_te, levels = 400, 200, 300
    c_tr = rng.integers(0, levels, size=n_tr)
    y_tr = rng.integers(0, 2, size=n_tr)
    c_te = rng.integers(0, levels, size=n_te)
    y_te = rng.integers(0, 2, size=n_te)
    leaky = target_encode(c_tr, y_tr, c_tr, 1.0)
    acc_leaky = float(np.mean((leaky > 0.5) == (y_tr == 1)))
    honest = target_encode(c_tr, y_tr, c_te, 1.0)
    acc_honest = float(np.mean((honest > 0.5) == (y_te == 1)))
    assert acc_leaky - acc_honest > 0.25, (
        "in-sample encoding must look much better than honest test score"
    )
    assert abs(acc_honest - 0.5) < 0.12, "honest score on noise must stay near chance"


def test_hidden_standardize_constant_column():
    X_train = np.array([[5.0, 1.0], [5.0, 3.0]])
    X_test = np.array([[7.0, 2.0]])
    tr, te = standardize(X_train, X_test)
    assert np.all(np.isfinite(tr)) and np.all(np.isfinite(te)), (
        "constant column must not give NaN or inf"
    )
    assert_close(te[0, 0], 2.0, atol=1e-9, message="zero std must be replaced by 1")


def test_hidden_smooth_mean_edges():
    assert_close(
        smooth_mean(1.0, 1, 0.3, 0.0), 1.0, atol=1e-12, message="m=0 must give the raw mean"
    )
    assert_close(
        smooth_mean(0.0, 0, 0.3, 0.0),
        0.3,
        atol=1e-12,
        message="empty category with m=0 must give prior",
    )
    assert_close(
        smooth_mean(0.0, 0, 0.3, 4.0), 0.3, atol=1e-12, message="empty category must give prior"
    )
