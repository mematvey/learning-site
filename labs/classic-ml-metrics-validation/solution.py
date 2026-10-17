"""Classification metrics: reference solution.

Labels are 0 or 1. Scores are real numbers: a higher score means "more positive".
"""

import numpy as np


def _binary_pair(y_true, y_pred):
    """Both inputs as boolean arrays of the same shape."""
    y_true = np.asarray(y_true).astype(bool)
    y_pred = np.asarray(y_pred).astype(bool)
    if y_true.shape != y_pred.shape:
        raise ValueError(
            f"y_true and y_pred must have the same shape, got {y_true.shape} and {y_pred.shape}"
        )
    return y_true, y_pred


def confusion_counts(y_true, y_pred):
    """Counts of the confusion matrix as a tuple (tn, fp, fn, tp)."""
    y_true, y_pred = _binary_pair(y_true, y_pred)
    tp = int(np.sum(y_true & y_pred))
    fp = int(np.sum(~y_true & y_pred))
    fn = int(np.sum(y_true & ~y_pred))
    tn = int(np.sum(~y_true & ~y_pred))
    return tn, fp, fn, tp


def accuracy(y_true, y_pred):
    """Fraction of correct answers: (tp + tn) / n."""
    tn, fp, fn, tp = confusion_counts(y_true, y_pred)
    n = tn + fp + fn + tp
    if n == 0:
        raise ValueError("accuracy of an empty sample is undefined")
    return (tp + tn) / n


def precision(y_true, y_pred):
    """tp / (tp + fp). Returns 0.0 when the model predicts no positives."""
    _, fp, _, tp = confusion_counts(y_true, y_pred)
    return tp / (tp + fp) if tp + fp > 0 else 0.0


def recall(y_true, y_pred):
    """tp / (tp + fn). Returns 0.0 when there are no positive objects."""
    _, _, fn, tp = confusion_counts(y_true, y_pred)
    return tp / (tp + fn) if tp + fn > 0 else 0.0


def f1_score(y_true, y_pred):
    """Harmonic mean 2pr / (p + r) of precision and recall. Returns 0.0 when p + r is 0."""
    p = precision(y_true, y_pred)
    r = recall(y_true, y_pred)
    return 2.0 * p * r / (p + r) if p + r > 0 else 0.0


def roc_auc(y_true, scores):
    """Probability that a random positive gets a higher score than a random negative.

    Ties count as one half. Computed by sorting the negative scores and counting,
    for every positive, the negatives below it and the negatives tied with it.
    Raises ValueError if there is no positive or no negative object.
    """
    y = np.asarray(y_true).astype(bool)
    s = np.asarray(scores, dtype=np.float64)
    if y.shape != s.shape:
        raise ValueError(f"y_true and scores must have the same shape, got {y.shape} and {s.shape}")
    pos = s[y]
    neg = np.sort(s[~y])
    if pos.size == 0 or neg.size == 0:
        raise ValueError("ROC AUC needs at least one positive and one negative object")
    below = np.searchsorted(neg, pos, side="left")
    below_or_equal = np.searchsorted(neg, pos, side="right")
    wins = below.sum() + 0.5 * (below_or_equal - below).sum()
    return float(wins / (pos.size * neg.size))


def standardize_with_train_stats(x_train, x_test):
    """Standardize both parts with the mean and std of the training part only.

    Returns (train_scaled, test_scaled). A column with zero std is only centered.
    """
    x_train = np.asarray(x_train, dtype=np.float64)
    x_test = np.asarray(x_test, dtype=np.float64)
    mean = x_train.mean(axis=0)
    std = x_train.std(axis=0)
    std = np.where(std > 0, std, 1.0)
    return (x_train - mean) / std, (x_test - mean) / std
