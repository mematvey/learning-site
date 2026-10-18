"""Hidden tests: parameter grids, lags longer than the series, too-short inputs.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def _pairs(splits):
    return [([int(i) for i in tr], [int(i) for i in te]) for tr, te in splits]


def _reference_expanding(n, n_splits, test_size, gap):
    out = []
    for k in range(n_splits):
        start = n - (n_splits - k) * test_size
        out.append((list(range(start - gap)), list(range(start, start + test_size))))
    return out


def _reference_sliding(n, n_splits, test_size, train_size, gap):
    out = []
    for k in range(n_splits):
        start = n - (n_splits - k) * test_size
        stop = start - gap
        out.append((list(range(stop - train_size, stop)), list(range(start, start + test_size))))
    return out


def test_hidden_expanding_grid_matches_reference():
    for n in (10, 17, 30):
        for n_splits in (1, 2, 4):
            for test_size in (1, 3):
                for gap in (0, 2):
                    if n - n_splits * test_size - gap < 1:
                        continue
                    got = _pairs(expanding_splits(n, n_splits, test_size, gap))
                    want = _reference_expanding(n, n_splits, test_size, gap)
                    assert got == want, (
                        f"mismatch for n={n}, splits={n_splits}, test={test_size}, gap={gap}"
                    )


def test_hidden_sliding_grid_matches_reference():
    for n in (12, 25):
        for n_splits in (2, 3):
            for test_size in (2, 4):
                for gap in (0, 1):
                    train_size = 5
                    if n - n_splits * test_size - gap - train_size < 0:
                        continue
                    got = _pairs(sliding_splits(n, n_splits, test_size, train_size, gap))
                    want = _reference_sliding(n, n_splits, test_size, train_size, gap)
                    assert got == want, (
                        f"mismatch for n={n}, splits={n_splits}, test={test_size}, gap={gap}"
                    )


def test_hidden_sliding_training_length_is_fixed():
    for tr, _ in _pairs(sliding_splits(30, 4, 3, 6, 1)):
        assert len(tr) == 6, f"training window must have length 6, got {len(tr)}"


def test_hidden_too_short_raises_value_error():
    for call in (
        lambda: expanding_splits(5, 3, 2),
        lambda: sliding_splits(12, 3, 2, 10),
    ):
        try:
            call()
        except ValueError:
            continue
        raise AssertionError("too short a series must raise ValueError")


def test_hidden_lag_features_match_reference():
    rng = np.random.default_rng(0)
    y = rng.normal(size=20)
    lags = [1, 3, 4]
    X, target = lag_features(y, lags)
    rows = []
    targets = []
    for t in range(max(lags), len(y)):
        rows.append([float(y[t - lag]) for lag in lags])
        targets.append(float(y[t]))
    assert_close(X, rows, atol=1e-12, message="lag matrix mismatch on random input, seed 0")
    assert_close(target, targets, atol=1e-12, message="target mismatch on random input, seed 0")


def test_hidden_lags_longer_than_series_give_no_rows():
    X, target = lag_features([1.0, 2.0, 3.0], [5])
    assert np.asarray(X).shape == (0, 1), "no rows expected when every lag is unknown"
    assert np.asarray(target).shape == (0,), "no targets expected when every lag is unknown"


def test_hidden_target_never_used_as_feature():
    # Changing the last value must change only its own target, never the features of earlier rows
    y = np.arange(10, dtype=float)
    X1, _ = lag_features(y, [1, 2])
    y2 = y.copy()
    y2[-1] = 999.0
    X2, _ = lag_features(y2, [1, 2])
    assert_close(X1, X2, atol=0, message="features must not depend on the current value")
