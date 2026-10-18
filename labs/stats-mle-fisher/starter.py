"""Maximum likelihood and Fisher information: starter code.

Complete the functions below so that they match the chapter text.
Bernoulli, normal (known sigma) and Poisson samples are passed as 1-D arrays.

The standard error of the MLE uses the Fisher information of one observation:
SE = 1 / sqrt(n * I(theta_hat)).
"""

import numpy as np


def mle_bernoulli(x):
    """MLE of the success probability p for a 0/1 sample `x`.

    Returns the share of ones in the sample as a float.
    Raises ValueError if `x` contains values other than 0 and 1.
    """
    x = np.asarray(x, dtype=np.float64)
    # TODO: the MLE is the sample mean of the 0/1 values
    raise NotImplementedError


def fisher_bernoulli(p):
    """Fisher information of one Bernoulli observation with success probability `p`.

    Valid for 0 < p < 1.
    """
    # TODO: I(p) = 1 / (p * (1 - p))
    raise NotImplementedError


def mle_normal(x):
    """MLE of the mean mu of a normal sample `x` with known sigma.

    Returns the sample mean as a float.
    """
    x = np.asarray(x, dtype=np.float64)
    # TODO: the MLE of the mean is the sample mean
    raise NotImplementedError


def fisher_normal(sigma):
    """Fisher information about the mean of one normal observation with known `sigma`."""
    # TODO: I(mu) = 1 / sigma**2
    raise NotImplementedError


def mle_poisson(x):
    """MLE of the rate lambda for a sample `x` of non-negative integer counts.

    Returns the sample mean as a float.
    """
    x = np.asarray(x, dtype=np.float64)
    # TODO: the MLE of the rate is the sample mean
    raise NotImplementedError


def fisher_poisson(lam):
    """Fisher information of one Poisson observation with rate `lam` (lam > 0)."""
    # TODO: I(lambda) = 1 / lambda
    raise NotImplementedError


def standard_error(fisher, n):
    """Standard error of the MLE from one-observation Fisher information `fisher` and sample size `n`.

    Returns 1 / sqrt(n * fisher).
    """
    # TODO: combine the per-observation information with the sample size n
    raise NotImplementedError
