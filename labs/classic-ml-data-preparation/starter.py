"""Leakage-free preprocessing: starter code.

Every transformation that learns from data (medians, mean and std, the list of
categories, target statistics) must learn only from the training part. The test
part is only transformed with the numbers learned on the training part.

Complete the functions marked TODO. Keep the signatures.
"""

import numpy as np


def impute_median(X_train, X_test):
    """Fill NaN with column medians learned on the training part only.

    X_train, X_test: 2D float arrays with NaN for missing values.
    Returns (X_train_filled, X_test_filled). The test part must use the
    training medians, even if its own values differ.
    """
    X_train = np.asarray(X_train, dtype=np.float64)
    X_test = np.asarray(X_test, dtype=np.float64)

    # TODO: compute column medians of X_train ignoring NaN, then replace NaN
    # in both arrays with those medians
    raise NotImplementedError


def standardize(X_train, X_test):
    """Standardize columns with the mean and std of the training part.

    Use the population std (ddof=0). A column with zero std is only centered
    (its std is treated as 1). Returns (X_train_scaled, X_test_scaled).
    """
    X_train = np.asarray(X_train, dtype=np.float64)
    X_test = np.asarray(X_test, dtype=np.float64)

    # TODO: take mean and std from X_train only, replace zero std by 1,
    # then scale both arrays with the same numbers
    raise NotImplementedError


def one_hot(c_train, c_test):
    """One-hot encode a categorical column.

    The categories are the distinct values of c_train, in sorted order.
    A category that is absent from c_train becomes a row of zeros.
    Returns (train_matrix, test_matrix) as float arrays of shape (n, n_categories).
    """
    # TODO: build the category list from c_train only, then fill 0/1 matrices
    raise NotImplementedError


def smooth_mean(positives, count, prior, m):
    """Smoothed mean of a category: (positives + m * prior) / (count + m).

    positives: sum of the target over the category's rows.
    count: number of rows in the category. prior: mean target over all rows.
    m: how many imaginary rows with the prior value are added.
    If count + m == 0, return prior.
    """
    # TODO: return the smoothed mean as described above
    raise NotImplementedError


def target_encode(c_train, y_train, c_test, m):
    """Target-encode the test categories with statistics of the training part.

    The prior is the mean of y_train. A category seen in training gets
    smooth_mean(sum of its targets, its count, prior, m). A category unseen in
    training gets the prior. Returns a float array of length len(c_test).
    """
    # TODO: collect sums and counts per category from the training rows only,
    # then encode each test value
    raise NotImplementedError


def target_encode_oof(c_train, y_train, folds, m):
    """Out-of-fold target encoding of the training rows.

    folds: integer array with the fold id of each training row.
    A row in fold k is encoded with target_encode, using only the rows that are
    NOT in fold k. So a row's encoding never depends on its own label.
    Returns a float array of length len(c_train).
    """
    # TODO: for each fold id, encode the rows of that fold with the other folds
    raise NotImplementedError


def prepare_features(num_train, num_test, oh_train, oh_test, te_train, te_test, y_train, folds, m):
    """Build the feature matrices for one train/test split without leakage.

    num_*: 2D numeric blocks with NaN (imputed by medians, then standardized).
    oh_*: 1D categorical columns for one-hot encoding (low cardinality).
    te_*: 1D categorical columns for target encoding (high cardinality);
          the training rows use target_encode_oof, the test rows use target_encode.
    y_train: training labels; folds: fold ids of the training rows.
    Returns (X_train, X_test) with columns [numeric..., one-hot..., target-encoded].
    """
    # TODO: impute and standardize the numeric block, one-hot the oh columns,
    # target-encode the te column, then join the blocks with np.hstack
    raise NotImplementedError
