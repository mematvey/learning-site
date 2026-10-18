"""Time series splits and lag features: starter code.

Complete the three functions so that they match the chapter text.
Indices start at 0. The training part of every split lies strictly before
its test part, and the gap leaves `gap` unused points between them.
"""

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
    # TODO: the test window of split k starts at n - (n_splits - k) * test_size.
    # The training part ends gap + 1 points before the test start.
    raise NotImplementedError


def sliding_splits(n, n_splits, test_size, train_size, gap=0):
    """Sliding-window splits over a series of length n.

    Same test windows as expanding_splits. The training part has a fixed
    length train_size and moves forward together with the test window.
    Raise ValueError if the first split does not have enough training points.
    """
    # TODO: reuse the test windows from expanding_splits; the training window
    # is train_size points that end just before the gap.
    raise NotImplementedError


def lag_features(y, lags):
    """Lag features and targets for a one-dimensional series y.

    lags is a list of positive integers. A row for time t uses y[t - lag]
    for every lag, and the target is y[t]. Only times where all lags exist
    (t >= max(lags)) are returned.

    Returns (X, target): X has shape (rows, len(lags)) with columns in the
    order of lags, and target has shape (rows,).
    """
    y = np.asarray(y, dtype=float)
    # TODO: pick the times t = max(lags), ..., len(y) - 1 and take y[t - lag]
    # for each lag, using a column per lag
    raise NotImplementedError
