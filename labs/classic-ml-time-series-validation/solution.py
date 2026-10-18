"""Time series splits and lag features: reference solution."""

import numpy as np


def expanding_splits(n, n_splits, test_size, gap=0):
    """Expanding-window splits over a series of length n.

    Returns a list of n_splits pairs (train, test) of index arrays.
    Test windows have test_size consecutive points, do not overlap, and the
    last one ends at index n - 1. Training always starts at index 0 and grows
    from one split to the next. There are `gap` unused points between the end
    of the training part and the start of the test part.
    Raise ValueError if the first split would have no training points.
    """
    splits = []
    for k in range(n_splits):
        test_start = n - (n_splits - k) * test_size
        train_end = test_start - gap - 1  # last training index, inclusive
        if train_end < 0:
            raise ValueError("series is too short for the requested splits")
        train = np.arange(0, train_end + 1)
        test = np.arange(test_start, test_start + test_size)
        splits.append((train, test))
    return splits


def sliding_splits(n, n_splits, test_size, train_size, gap=0):
    """Sliding-window splits over a series of length n.

    Same test windows as expanding_splits. The training part has a fixed
    length train_size and moves forward together with the test window.
    Raise ValueError if the first split does not have enough training points.
    """
    splits = []
    for k in range(n_splits):
        test_start = n - (n_splits - k) * test_size
        train_end = test_start - gap - 1
        train_start = train_end - train_size + 1
        if train_start < 0:
            raise ValueError("series is too short for the requested splits")
        train = np.arange(train_start, train_end + 1)
        test = np.arange(test_start, test_start + test_size)
        splits.append((train, test))
    return splits


def lag_features(y, lags):
    """Lag features and targets for a one-dimensional series y.

    lags is a list of positive integers. A row for time t uses y[t - lag]
    for every lag, and the target is y[t]. Only times where all lags exist
    (t >= max(lags)) are returned.

    Returns (X, target): X has shape (rows, len(lags)) with columns in the
    order of lags, and target has shape (rows,).
    """
    y = np.asarray(y, dtype=float)
    lags = [int(lag) for lag in lags]
    if not lags or min(lags) < 1:
        raise ValueError("lags must be a non-empty list of positive integers")
    times = np.arange(max(lags), len(y))
    X = np.column_stack([y[times - lag] for lag in lags])
    target = y[times]
    return X, target
