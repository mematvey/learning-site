"""Basic distributions: starter code.

Complete the four functions so that they match the chapter text. Probabilities
for large n or lambda must not overflow: work in log space (math.lgamma helps).
"""

import numpy as np


def binom_pmf(k, n, p):
    """P(X = k) for X ~ Bin(n, p).

    Returns 0.0 for k outside 0..n. Must handle p = 0 and p = 1.
    """
    # TODO: binomial coefficient times p^k (1 - p)^(n - k)
    raise NotImplementedError


def poisson_pmf(k, lam):
    """P(X = k) for X ~ Pois(lam).

    Returns 0.0 for negative k. lam = 0 puts all mass at k = 0.
    """
    # TODO: lam^k e^(-lam) / k!
    raise NotImplementedError


def normal_pdf(x, mu, var):
    """Density of N(mu, var) at x. `var` is the variance, not the standard deviation.

    Vectorized: x may be an array; the result has the same shape.
    """
    x = np.asarray(x, dtype=np.float64)
    # TODO: 1 / (sigma sqrt(2 pi)) * exp(-(x - mu)^2 / (2 sigma^2)), sigma^2 = var
    raise NotImplementedError


def sample_by_inverse_cdf(pmf, u):
    """Discrete inverse-transform sampling.

    pmf: probabilities of the values 0, 1, ..., len(pmf) - 1.
    u: uniform numbers in (0, 1). Returns, for each u, the smallest k with
    F(k) >= u, where F is the cumulative sum of pmf. If rounding leaves u above
    the total mass, the last value is returned.
    """
    pmf = np.asarray(pmf, dtype=np.float64)
    u = np.asarray(u, dtype=np.float64)
    # TODO: cumulative sums of pmf, then find the first index where F(k) >= u
    raise NotImplementedError
