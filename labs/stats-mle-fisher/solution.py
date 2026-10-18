"""Maximum likelihood and Fisher information: reference solution."""

import numpy as np


def mle_bernoulli(x):
    """MLE of the success probability p for a 0/1 sample `x`. Raises ValueError on other values."""
    x = np.asarray(x, dtype=np.float64)
    if not np.all((x == 0) | (x == 1)):
        raise ValueError("Bernoulli sample must contain only 0 and 1")
    return float(x.mean())


def fisher_bernoulli(p):
    """Fisher information of one Bernoulli observation: 1 / (p * (1 - p))."""
    return 1.0 / (p * (1.0 - p))


def mle_normal(x):
    """MLE of the mean mu of a normal sample with known sigma: the sample mean."""
    x = np.asarray(x, dtype=np.float64)
    return float(x.mean())


def fisher_normal(sigma):
    """Fisher information about the mean of one normal observation: 1 / sigma**2."""
    return 1.0 / sigma**2


def mle_poisson(x):
    """MLE of the rate lambda for Poisson counts: the sample mean."""
    x = np.asarray(x, dtype=np.float64)
    return float(x.mean())


def fisher_poisson(lam):
    """Fisher information of one Poisson observation: 1 / lambda."""
    return 1.0 / lam


def standard_error(fisher, n):
    """Standard error of the MLE: 1 / sqrt(n * fisher)."""
    return 1.0 / np.sqrt(n * fisher)
