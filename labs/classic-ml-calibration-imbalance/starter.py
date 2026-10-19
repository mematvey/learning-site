"""Calibration error, Platt scaling and a cost-based threshold: starter code.

Complete the five functions below so that they match the chapter text.
Use only NumPy (add `import numpy as np` at the top) and the standard library.
Names and signatures must not change.
"""


def expected_calibration_error(probs, labels, n_bins=10):
    """Expected calibration error (ECE) with `n_bins` equal-width bins over [0, 1].

    probs: predicted probabilities of the positive class, shape (n,).
    labels: true labels in {0, 1}, shape (n,).
    Put each object into bin min(int(p * n_bins), n_bins - 1). Skip empty bins.
    Return sum over bins of (n_m / n) * |mean(labels in bin) - mean(probs in bin)|.
    """
    raise NotImplementedError


def platt_probs(scores, a, b):
    """Platt-scaled probabilities sigmoid(a * logit(s) + b), shape (n,).

    scores: model outputs s in (0, 1), shape (n,). logit(s) = ln(s / (1 - s)).
    Clip s to [1e-12, 1 - 1e-12] before the logit. Must not overflow for large inputs.
    """
    raise NotImplementedError


def fit_platt(scores, labels, lr=0.1, steps=5000):
    """Fit a and b by plain gradient descent on the mean log-loss.

    Start from a = 1, b = 0 and take `steps` steps of size `lr`.
    Let x = logit(scores) (clip the scores as in platt_probs).
    The gradient of the mean log-loss is mean((p - y) * x) for a and mean(p - y) for b,
    where p = platt_probs(scores, a, b). Return (a, b) as floats.
    """
    raise NotImplementedError


def best_threshold(c_fp, c_fn):
    """Probability threshold that minimizes the expected cost of calibrated probabilities.

    c_fp: cost of a false positive, c_fn: cost of a false negative (both > 0).
    Predict positive when p is above the returned value.
    """
    raise NotImplementedError


def weighted_probability(p, w):
    """Probability after giving the positive class weight `w` in the loss.

    p: calibrated probability before weighting, w: positive weight (> 0).
    Return w * p / (w * p + 1 - p). The result is not calibrated any more.
    """
    raise NotImplementedError
