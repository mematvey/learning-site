"""Confidence intervals and z/t tests for a mean: reference solution."""

import math

import numpy as np


def ci_known_sigma(x, sigma, z_quantile):
    """Confidence interval for the mean when the standard deviation sigma is known.

    x: 1-D array of n >= 1 observations. sigma: known population std, > 0.
    z_quantile: standard normal quantile z_{1-alpha/2}, e.g. 1.959964 for 95%.
    Returns (low, high) with low = mean - z * sigma / sqrt(n) and
    high = mean + z * sigma / sqrt(n).
    """
    x = np.asarray(x, dtype=np.float64)
    half = z_quantile * sigma / math.sqrt(x.size)
    mean = float(x.mean())
    return mean - half, mean + half


def ci_t(x, t_quantile):
    """Confidence interval for the mean when sigma is unknown (t interval).

    x: 1-D array of n >= 2 observations. The sample std uses ddof=1.
    t_quantile: quantile t_{1-alpha/2, n-1} of Student's t distribution.
    Returns (low, high). Raises ValueError if there are fewer than 2 observations.
    """
    x = np.asarray(x, dtype=np.float64)
    if x.size < 2:
        raise ValueError("t interval needs at least 2 observations")
    s = float(x.std(ddof=1))
    half = t_quantile * s / math.sqrt(x.size)
    mean = float(x.mean())
    return mean - half, mean + half


def z_test(x, mu0, sigma):
    """Two-sided z-test of H0: mean = mu0 with known sigma.

    Returns (z, p_value) with z = (mean - mu0) / (sigma / sqrt(n)) and
    p_value = 2 * (1 - Phi(|z|)). The erfc form below is the same number.
    """
    x = np.asarray(x, dtype=np.float64)
    z = (float(x.mean()) - mu0) / (sigma / math.sqrt(x.size))
    p_value = math.erfc(abs(z) / math.sqrt(2.0))
    return z, p_value


def t_test(x, mu0, t_quantile):
    """Two-sided one-sample t-test of H0: mean = mu0 with unknown sigma.

    t_quantile: critical value t_{1-alpha/2, n-1}. Returns (t, reject) where
    t = (mean - mu0) / (s / sqrt(n)) with ddof=1 and reject = |t| > t_quantile.
    Raises ValueError if there are fewer than 2 observations.
    """
    x = np.asarray(x, dtype=np.float64)
    if x.size < 2:
        raise ValueError("t-test needs at least 2 observations")
    s = float(x.std(ddof=1))
    t = (float(x.mean()) - mu0) / (s / math.sqrt(x.size))
    return t, bool(abs(t) > t_quantile)
