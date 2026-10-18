"""Bootstrap standard error, percentile interval and permutation test: reference solution."""

from itertools import combinations
from math import comb

import numpy as np

# Tolerance for comparing test statistics, so that the observed split always counts itself.
TOL = 1e-9


def _as_float_array(x):
    return np.asarray(x, dtype=np.float64).ravel()


def _bootstrap_means(x, n_boot, seed):
    """Means of `n_boot` resamples of `x` drawn with replacement, same size as `x`."""
    x = _as_float_array(x)
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, x.size, size=(n_boot, x.size))
    return x[idx].mean(axis=1)


def bootstrap_se(x, n_boot=20000, seed=0):
    """Bootstrap standard error of the sample mean of `x`.

    Returns the sample standard deviation (ddof=1) of the bootstrap means.
    """
    return float(np.std(_bootstrap_means(x, n_boot, seed), ddof=1))


def percentile_interval(x, level=0.95, n_boot=20000, seed=0):
    """Percentile bootstrap interval for the mean of `x` at confidence `level`."""
    means = _bootstrap_means(x, n_boot, seed)
    alpha = (1.0 - level) / 2.0
    lo, hi = np.quantile(means, [alpha, 1.0 - alpha])
    return float(lo), float(hi)


def _exact_pvalue(a, b):
    pooled = np.concatenate([a, b]).tolist()
    n_a, n_b = a.size, b.size
    total = sum(pooled)
    observed = abs(b.mean() - a.mean())
    count = 0
    # Every split of the pooled sample into groups of sizes n_a and n_b is equally likely under H0.
    for idx in combinations(range(len(pooled)), n_b):
        sum_b = sum(pooled[i] for i in idx)
        stat = sum_b / n_b - (total - sum_b) / n_a
        if abs(stat) >= observed - TOL:
            count += 1
    return count / comb(len(pooled), n_b)


def _mc_pvalue(a, b, n_perm, seed):
    pooled = np.concatenate([a, b])
    n_a = a.size
    observed = abs(b.mean() - a.mean())
    rng = np.random.default_rng(seed)
    count = 0
    for _ in range(n_perm):
        perm = rng.permutation(pooled)
        stat = abs(perm[n_a:].mean() - perm[:n_a].mean())
        if stat >= observed - TOL:
            count += 1
    return (1 + count) / (1 + n_perm)


def permutation_pvalue(a, b, method="exact", n_perm=10000, seed=0):
    """Two-sided permutation p-value for the difference of means `mean(b) - mean(a)`.

    method="exact" enumerates all splits of the pooled sample; method="mc" uses `n_perm`
    random permutations with the (1 + count) / (1 + n_perm) correction.
    """
    a = _as_float_array(a)
    b = _as_float_array(b)
    if method == "exact":
        return _exact_pvalue(a, b)
    if method == "mc":
        return _mc_pvalue(a, b, n_perm, seed)
    raise ValueError(f"unknown method {method!r}")
