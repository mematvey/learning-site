"""Beta-Binomial updating: reference solution."""

import math


def beta_cdf(x, a, b):
    """CDF of Beta(a, b) at x, for a > 0 and b > 0."""
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
    return a + k, b + n - k


def posterior_mean(a, b):
    """Mean of Beta(a, b): a / (a + b)."""
    return a / (a + b)


def _quantile(p, a, b):
    """Inverts beta_cdf by bisection on [0, 1]."""
    lo, hi = 0.0, 1.0
    while hi - lo > 1e-10:
        mid = 0.5 * (lo + hi)
        if beta_cdf(mid, a, b) < p:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def credible_interval(a, b, level=0.95):
    """Equal-tailed credible interval (lower, upper) of Beta(a, b) with probability `level`."""
    tail = (1.0 - level) / 2.0
    return _quantile(tail, a, b), _quantile(1.0 - tail, a, b)
