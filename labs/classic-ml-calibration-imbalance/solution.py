"""Calibration error, Platt scaling and a cost-based threshold: reference solution."""

import numpy as np


def expected_calibration_error(probs, labels, n_bins=10):
    """Expected calibration error (ECE) with `n_bins` equal-width bins over [0, 1].

    probs: predicted probabilities of the positive class, shape (n,).
    labels: true labels in {0, 1}, shape (n,).
    Put each object into bin min(int(p * n_bins), n_bins - 1). Skip empty bins.
    Return sum over bins of (n_m / n) * |mean(labels in bin) - mean(probs in bin)|.
    """
    p = np.asarray(probs, dtype=np.float64)
    y = np.asarray(labels, dtype=np.float64)
    bin_index = np.minimum((p * n_bins).astype(int), n_bins - 1)
    n = p.size
    ece = 0.0
    for m in range(n_bins):
        mask = bin_index == m
        count = int(mask.sum())
        if count == 0:
            continue
        confidence = p[mask].mean()
        accuracy = y[mask].mean()
        ece += count / n * abs(accuracy - confidence)
    return float(ece)


def platt_probs(scores, a, b):
    """Platt-scaled probabilities sigmoid(a * scores + b), shape (n,).

    Must not overflow for large positive or negative inputs.
    """
    z = np.clip(a * np.asarray(scores, dtype=np.float64) + b, -500.0, 500.0)
    return 1.0 / (1.0 + np.exp(-z))


def fit_platt(scores, labels, lr=0.1, steps=5000):
    """Fit a and b by plain gradient descent on the mean log-loss.

    Start from a = 1, b = 0 and take `steps` steps of size `lr`.
    The gradient of the mean log-loss is mean((p - y) * s) for a and mean(p - y) for b,
    where p = platt_probs(scores, a, b). Return (a, b) as floats.
    """
    s = np.asarray(scores, dtype=np.float64)
    y = np.asarray(labels, dtype=np.float64)
    a, b = 1.0, 0.0
    for _ in range(steps):
        err = platt_probs(s, a, b) - y
        a -= lr * np.mean(err * s)
        b -= lr * np.mean(err)
    return float(a), float(b)


def best_threshold(c_fp, c_fn):
    """Probability threshold that minimizes the expected cost of calibrated probabilities.

    c_fp: cost of a false positive, c_fn: cost of a false negative (both > 0).
    Predict positive when p is above the returned value.
    """
    return c_fp / (c_fp + c_fn)


def weighted_probability(p, w):
    """Probability after giving the positive class weight `w` in the loss.

    p: calibrated probability before weighting, w: positive weight (> 0).
    Return w * p / (w * p + 1 - p). The result is not calibrated any more.
    """
    return w * p / (w * p + 1.0 - p)
