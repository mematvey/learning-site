"""Confidence intervals and z/t tests for a mean: starter code.

Complete the four functions so that they match the chapter text. Quantiles are
passed in as arguments: only NumPy is available here, so no SciPy lookup.
"""


def ci_known_sigma(x, sigma, z_quantile):
    """Confidence interval for the mean when the standard deviation sigma is known.

    x: 1-D array of n >= 1 observations. sigma: known population std, > 0.
    z_quantile: standard normal quantile z_{1-alpha/2}, e.g. 1.959964 for 95%.
    Returns (low, high) with low = mean - z * sigma / sqrt(n).
    """
    # TODO: the mean of x and the half-width z * sigma / sqrt(n)
    raise NotImplementedError("ci_known_sigma is not implemented yet")


def ci_t(x, t_quantile):
    """Confidence interval for the mean when sigma is unknown (t interval).

    x: 1-D array of n >= 2 observations. Use the sample std with ddof=1.
    t_quantile: quantile t_{1-alpha/2, n-1} of Student's t distribution.
    Returns (low, high). Raise ValueError if there are fewer than 2 observations.
    """
    # TODO: check the size, then the sample std with ddof=1 and the half-width
    raise NotImplementedError("ci_t is not implemented yet")


def z_test(x, mu0, sigma):
    """Two-sided z-test of H0: mean = mu0 with known sigma.

    Returns (z, p_value) with z = (mean - mu0) / (sigma / sqrt(n)) and
    p_value = 2 * (1 - Phi(|z|)), where Phi is the standard normal CDF.
    Phi can be written with math.erf.
    """
    # TODO: the statistic z, then the two-sided p-value
    raise NotImplementedError("z_test is not implemented yet")


def t_test(x, mu0, t_quantile):
    """Two-sided one-sample t-test of H0: mean = mu0 with unknown sigma.

    t_quantile: critical value t_{1-alpha/2, n-1}. Returns (t, reject) where
    t = (mean - mu0) / (s / sqrt(n)) with ddof=1 and reject = |t| > t_quantile.
    Raise ValueError if there are fewer than 2 observations.
    """
    # TODO: the statistic t and the decision against the critical value
    raise NotImplementedError("t_test is not implemented yet")
