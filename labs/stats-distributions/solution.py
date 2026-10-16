"""Basic distributions: reference solution."""

import math

import numpy as np


def binom_pmf(k, n, p):
    """P(X = k) for X ~ Bin(n, p), computed in log space.

    Returns 0.0 for k outside 0..n. Handles p = 0 and p = 1 exactly.
    """
    n = int(n)
    k = int(k)
    if k < 0 or k > n:
        return 0.0
    if p == 0.0:
        return 1.0 if k == 0 else 0.0
    if p == 1.0:
        return 1.0 if k == n else 0.0
    log_comb = math.lgamma(n + 1) - math.lgamma(k + 1) - math.lgamma(n - k + 1)
    log_prob = log_comb + k * math.log(p) + (n - k) * math.log1p(-p)
    return math.exp(log_prob)


def poisson_pmf(k, lam):
    """P(X = k) for X ~ Pois(lam), computed in log space.

    Returns 0.0 for negative k. lam = 0 puts all mass at k = 0.
    """
    k = int(k)
    if k < 0:
        return 0.0
    if lam == 0:
        return 1.0 if k == 0 else 0.0
    log_prob = k * math.log(lam) - lam - math.lgamma(k + 1)
    return math.exp(log_prob)


def normal_pdf(x, mu, var):
    """Density of N(mu, var) at x. `var` is the variance, not the standard deviation.

    Vectorized: x may be an array; the result has the same shape.
    """
    x = np.asarray(x, dtype=np.float64)
    return np.exp(-((x - mu) ** 2) / (2.0 * var)) / np.sqrt(2.0 * np.pi * var)


def sample_by_inverse_cdf(pmf, u):
    """Discrete inverse-transform sampling.

    pmf: probabilities of the values 0, 1, ..., len(pmf) - 1.
    u: uniform numbers in (0, 1). Returns, for each u, the smallest k with
    F(k) >= u, where F is the cumulative sum of pmf. If rounding leaves u above
    the total mass, the last value is returned.
    """
    pmf = np.asarray(pmf, dtype=np.float64)
    u = np.asarray(u, dtype=np.float64)
    cdf = np.cumsum(pmf)
    idx = np.searchsorted(cdf, u, side="left")
    return np.minimum(idx, len(pmf) - 1)
