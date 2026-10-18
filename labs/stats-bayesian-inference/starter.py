"""Beta-Binomial updating: starter code.

A prior Beta(a, b) on the success probability theta is updated with k successes
in n independent trials. The posterior is Beta(a + k, b + n - k).

Complete `update`, `posterior_mean` and `credible_interval`. `beta_cdf` is given:
it is the regularized incomplete beta function and needs no scipy.
"""

import math


def beta_cdf(x, a, b):
    """CDF of Beta(a, b) at x, for a > 0 and b > 0 (given, do not change)."""
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    log_front = (
        math.lgamma(a + b)
        - math.lgamma(a)
        - math.lgamma(b)
        + a * math.log(x)
        + b * math.log(1.0 - x)
    )
    if x < (a + 1.0) / (a + b + 2.0):
        return math.exp(log_front) * _beta_continued_fraction(a, b, x) / a
    return 1.0 - math.exp(log_front) * _beta_continued_fraction(b, a, 1.0 - x) / b


def _beta_continued_fraction(a, b, x):
    """Continued fraction for the incomplete beta function (modified Lentz method)."""
    tiny = 1e-300
    qab = a + b
    qap = a + 1.0
    qam = a - 1.0
    c = 1.0
    d = 1.0 - qab * x / qap
    d = 1.0 / (d if abs(d) > tiny else tiny)
    h = d
    for m in range(1, 400):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        d = 1.0 / (d if abs(d) > tiny else tiny)
        c = 1.0 + aa / c
        c = c if abs(c) > tiny else tiny
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        d = 1.0 / (d if abs(d) > tiny else tiny)
        c = 1.0 + aa / c
        c = c if abs(c) > tiny else tiny
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < 1e-15:
            break
    return h


def update(a, b, k, n):
    """Beta(a, b) prior, k successes in n trials -> posterior parameters (A, B)."""
    # TODO: return the posterior parameters A = a + k and B = b + n - k
    raise NotImplementedError


def posterior_mean(a, b):
    """Mean of Beta(a, b): a / (a + b)."""
    # TODO: return the mean of the Beta(a, b) distribution
    raise NotImplementedError


def credible_interval(a, b, level=0.95):
    """Equal-tailed credible interval (lower, upper) of Beta(a, b) with probability `level`.

    The bounds are the quantiles at (1 - level) / 2 and (1 + level) / 2. Find each
    quantile by bisection on [0, 1]: keep the half where beta_cdf still crosses the
    target, and stop when the interval is shorter than 1e-10.
    """
    # TODO: with tail = (1 - level) / 2, bisect beta_cdf(x, a, b) to find the x where
    # the CDF equals tail (lower bound) and the x where it equals 1 - tail (upper bound)
    raise NotImplementedError
