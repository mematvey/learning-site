"""Bootstrap intervals for accuracy and for the difference of two models: reference solution."""

import numpy as np


def _as_flags(values, name):
    """Returns a 1-D float array of 0/1 correctness flags, or raises ValueError."""
    arr = np.asarray(values, dtype=np.float64).ravel()
    if arr.size == 0:
        raise ValueError(f"{name} must not be empty")
    if not np.all((arr == 0.0) | (arr == 1.0)):
        raise ValueError(f"{name} must contain only 0 and 1")
    return arr


def _check_same_size(a, b):
    if a.size != b.size:
        raise ValueError(f"samples must have the same size, got {a.size} and {b.size}")


def _percentile_interval(stats, level):
    """Central percentile interval of the bootstrap distribution."""
    tail = (1.0 - level) / 2.0
    lo, hi = np.quantile(stats, [tail, 1.0 - tail])
    return float(lo), float(hi)


def accuracy_ci(correct, n_boot=2000, seed=0, level=0.95):
    """Percentile bootstrap interval for the accuracy of one model.

    `correct` holds 0/1 flags, one per example. Examples are resampled with
    replacement `n_boot` times; the interval is the central `level` part of the
    resampled accuracies. Returns (low, high).
    """
    x = _as_flags(correct, "correct")
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, x.size, size=(n_boot, x.size))
    return _percentile_interval(x[idx].mean(axis=1), level)


def paired_diff_ci(correct_a, correct_b, n_boot=2000, seed=0, level=0.95):
    """Paired bootstrap interval for accuracy(A) - accuracy(B).

    Both models are evaluated on the same examples. Each resample draws example
    indices once and uses them for both models, so the pairs stay together.
    Returns (low, high).
    """
    a = _as_flags(correct_a, "correct_a")
    b = _as_flags(correct_b, "correct_b")
    _check_same_size(a, b)
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, a.size, size=(n_boot, a.size))
    stats = a[idx].mean(axis=1) - b[idx].mean(axis=1)
    return _percentile_interval(stats, level)


def unpaired_diff_ci(correct_a, correct_b, n_boot=2000, seed=0, level=0.95):
    """Unpaired bootstrap interval for accuracy(A) - accuracy(B).

    Each model is resampled on its own, as if the two were independent samples.
    Returns (low, high).
    """
    a = _as_flags(correct_a, "correct_a")
    b = _as_flags(correct_b, "correct_b")
    _check_same_size(a, b)
    rng = np.random.default_rng(seed)
    idx_a = rng.integers(0, a.size, size=(n_boot, a.size))
    idx_b = rng.integers(0, b.size, size=(n_boot, b.size))
    stats = a[idx_a].mean(axis=1) - b[idx_b].mean(axis=1)
    return _percentile_interval(stats, level)
