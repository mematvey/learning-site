"""A/B testing: sample size, power and peeking. Starter code.

`norm_cdf` and `norm_ppf` are given. Implement the four functions marked TODO
so that they match the chapter text: the formulas for sample size and power,
the Bonferroni critical value, and a simulation of repeated looks at an A/A test.
"""

import math

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
    Use n = 2 sigma^2 (z_{1-alpha/2} + z_{power})^2 / delta^2, rounded up to an integer.
    Return an int.
    """
    # TODO: compute the sample size from the formula above, using norm_ppf
    raise NotImplementedError


def power(n_per_group, sigma, delta, alpha=0.05):
    """Approximate power of the same test for n users per group and true effect delta.

    Use power = Phi(delta / sqrt(2 sigma^2 / n) - z_{1-alpha/2}), where Phi is norm_cdf.
    Return a float between 0 and 1.
    """
    # TODO: compute the power from the formula above
    raise NotImplementedError


def bonferroni_z(k, alpha=0.05):
    """Two-sided critical z for each of k comparisons after the Bonferroni correction.

    Each comparison uses level alpha / k, so the critical value is z_{1-alpha/(2k)}.
    """
    # TODO: return the critical value for level alpha / k, two-sided
    raise NotImplementedError


def peeking_false_positive_rate(looks, n_per_group=200, runs=8000, alpha=0.05, seed=0):
    """Share of A/A experiments that a z-test declares significant at some look.

    Both groups draw standard normal observations (sigma = 1, no real effect).
    The data are checked `looks` times at equally spaced moments: after
    n_per_group * k // looks users per group, for k = 1..looks. An experiment is
    counted as a false positive if |z| exceeds the two-sided critical value for
    `alpha` at any look. Use numpy with np.random.default_rng(seed) so the result
    is reproducible. Return a float.
    """
    # TODO: simulate `runs` A/A experiments and count the ones that stop at any look
    raise NotImplementedError
