"""Law of large numbers and CLT by simulation: reference solution."""

import numpy as np


def sample_means(sampler, n, repeats, seed=0):
    """Simulates `repeats` samples of size `n` and returns their means.

    sampler: callable `sampler(rng, size)` that returns an array of i.i.d. draws
    with the given `size` (a tuple). rng: a `numpy.random.Generator` seeded with `seed`.
    Returns a 1-D array of length `repeats`; element i is the mean of sample i.
    """
    rng = np.random.default_rng(seed)
    draws = np.asarray(sampler(rng, (repeats, n)), dtype=np.float64)
    return draws.mean(axis=1)


def standard_error(sigma, n):
    """Standard error of the mean of n i.i.d. measurements with std `sigma`: sigma / sqrt(n)."""
    if n < 1:
        raise ValueError(f"n must be a positive integer, got {n}")
    return sigma / np.sqrt(n)


def empirical_standard_error(means):
    """Sample standard deviation of simulated means (ddof=1), an estimate of the standard error."""
    means = np.asarray(means, dtype=np.float64)
    return float(np.std(means, ddof=1))


def standardized_means(means, mu, sigma, n):
    """CLT normalization Z = (mean - mu) / (sigma / sqrt(n)) for each simulated mean."""
    means = np.asarray(means, dtype=np.float64)
    return (means - mu) / standard_error(sigma, n)
