"""A/B testing: sample size, power and peeking. Reference solution."""

import math

import numpy as np

# Acklam's rational approximation of the inverse standard normal CDF.
_A = [
    -3.969683028665376e01,
    2.209460984245205e02,
    -2.759285104469687e02,
    1.383577518672690e02,
    -3.066479806614716e01,
    2.506628277459239e00,
]
_B = [
    -5.447609879822406e01,
    1.615858368580409e02,
    -1.556989798598866e02,
    6.680131188771972e01,
    -1.328068155288572e01,
]
_C = [
    -7.784894002430293e-03,
    -3.223964580411365e-01,
    -2.400758277161838e00,
    -2.549732539343734e00,
    4.374664141464968e00,
    2.938163982698783e00,
]
_D = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e00, 3.754408661907416e00]


def _horner(coeffs, x):
    """Evaluates coeffs[0] * x**(n-1) + ... + coeffs[-1] for a list of coefficients."""
    result = 0.0
    for c in coeffs:
        result = result * x + c
    return result


def norm_cdf(z):
    """Standard normal CDF Phi(z), via the error function from the standard library."""
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


def norm_ppf(p):
    """Inverse standard normal CDF for 0 < p < 1 (Acklam's approximation, rel. error ~1e-9)."""
    if not 0.0 < p < 1.0:
        raise ValueError(f"p must be in (0, 1), got {p}")
    p_low = 0.02425
    if p < p_low:
        q = math.sqrt(-2.0 * math.log(p))
        return _horner(_C, q) / (q * _horner(_D, q) + 1.0)
    if p > 1.0 - p_low:
        q = math.sqrt(-2.0 * math.log(1.0 - p))
        return -_horner(_C, q) / (q * _horner(_D, q) + 1.0)
    q = p - 0.5
    r = q * q
    return _horner(_A, r) * q / (r * _horner(_B, r) + 1.0)


def sample_size_per_group(sigma, delta, alpha=0.05, target_power=0.8):
    """Users per group for a two-sided two-sample z-test on the difference of means.

    sigma: standard deviation of the metric (same in both groups).
    delta: minimal difference of means worth detecting.
    Returns n = 2 sigma^2 (z_{1-alpha/2} + z_{power})^2 / delta^2, rounded up.
    """
    z_alpha = norm_ppf(1.0 - alpha / 2.0)
    z_power = norm_ppf(target_power)
    n = 2.0 * sigma**2 * (z_alpha + z_power) ** 2 / delta**2
    return math.ceil(n)


def power(n_per_group, sigma, delta, alpha=0.05):
    """Approximate power of the same test for n users per group and true effect delta.

    Power = Phi(delta / sqrt(2 sigma^2 / n) - z_{1-alpha/2}).
    The second tail of the distribution is ignored, as in the chapter.
    """
    z_alpha = norm_ppf(1.0 - alpha / 2.0)
    se = math.sqrt(2.0 * sigma**2 / n_per_group)
    return norm_cdf(delta / se - z_alpha)


def bonferroni_z(k, alpha=0.05):
    """Two-sided critical z for each of k looks or metrics with Bonferroni: z_{1-alpha/(2k)}."""
    return norm_ppf(1.0 - alpha / (2.0 * k))


def peeking_false_positive_rate(looks, n_per_group=200, runs=8000, alpha=0.05, seed=0):
    """Share of A/A experiments that a z-test declares significant at some look.

    Both groups draw standard normal observations (no real effect). The data are
    checked `looks` times at equally spaced moments; the experiment stops at the
    first look where |z| exceeds the two-sided critical value for `alpha`.
    """
    rng = np.random.default_rng(seed)
    a = rng.normal(size=(runs, n_per_group))
    b = rng.normal(size=(runs, n_per_group))
    # Running sums of paired differences: sum(b - a) over the first m users.
    running = np.cumsum(b - a, axis=1)
    z_crit = norm_ppf(1.0 - alpha / 2.0)
    stopped = np.zeros(runs, dtype=bool)
    for k in range(1, looks + 1):
        m = n_per_group * k // looks
        # Var(sum of m differences) = 2 m when sigma = 1.
        z = running[:, m - 1] / math.sqrt(2.0 * m)
        stopped |= np.abs(z) > z_crit
    return float(stopped.mean())
