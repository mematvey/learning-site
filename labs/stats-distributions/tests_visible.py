"""Visible tests. `binom_pmf`, `poisson_pmf`, `normal_pdf`, `sample_by_inverse_cdf`
and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def test_binom_hand_case():
    # P(X = 5) for Bin(10, 1/2) = C(10, 5) / 2^10 = 252 / 1024
    p = binom_pmf(5, 10, 0.5)
    assert_close(p, 252 / 1024, atol=1e-6, message=f"expected {252 / 1024:.6f}, got {p:.6f}")


def test_binom_pmf_sums_to_one():
    total = sum(binom_pmf(k, 10, 0.3) for k in range(11))
    assert_close(total, 1.0, atol=1e-6, message=f"PMF over k = 0..10 sums to {total:.8f}")


def test_poisson_hand_case():
    # P(X = 0) = e^-3 and P(X = 2) = 4.5 e^-3 for Pois(3)
    p0 = poisson_pmf(0, 3.0)
    p2 = poisson_pmf(2, 3.0)
    assert_close(p0, 0.04978707, atol=1e-6, message=f"P(X = 0): expected 0.04978707, got {p0:.8f}")
    assert_close(p2, 0.22404180, atol=1e-6, message=f"P(X = 2): expected 0.22404180, got {p2:.8f}")


def test_poisson_pmf_sums_to_one():
    total = sum(poisson_pmf(k, 3.0) for k in range(81))
    assert_close(total, 1.0, atol=1e-6, message=f"PMF over k = 0..80 sums to {total:.8f}")


def test_normal_pdf_hand_case():
    # The second argument is the variance: N(0, 4) has sigma = 2, peak 1 / (2 sqrt(2 pi)).
    assert_close(
        normal_pdf(0.0, 0.0, 1.0),
        0.39894228,
        atol=1e-6,
        message="N(0, 1) at 0 must be 1 / sqrt(2 pi)",
    )
    assert_close(
        normal_pdf(0.0, 0.0, 4.0),
        0.19947114,
        atol=1e-6,
        message="the third argument is the variance, not sigma",
    )


def test_normal_pdf_integrates_to_one():
    xs = np.linspace(-10.0, 12.0, 20001)
    ys = normal_pdf(xs, 1.0, 2.25)
    integral = np.sum((ys[1:] + ys[:-1]) * np.diff(xs)) / 2.0
    assert_close(integral, 1.0, atol=1e-6, message=f"integral of the density is {integral:.8f}")


def test_inverse_cdf_hand_case():
    # F = [0.25, 0.5, 1.0]: the smallest k with F(k) >= u
    pmf = [0.25, 0.25, 0.5]
    samples = sample_by_inverse_cdf(pmf, [0.1, 0.25, 0.3, 0.5, 0.9])
    assert_close(
        samples,
        [0, 0, 1, 1, 2],
        atol=1e-6,
        message=f"expected [0, 0, 1, 1, 2], got {np.asarray(samples).tolist()}",
    )


def test_inverse_cdf_sample_mean_matches_binomial():
    # Bin(10, 1/2) has mean np = 5. Fixed seed, so the result is the same on every run.
    rng = np.random.default_rng(0)
    pmf = np.array([binom_pmf(k, 10, 0.5) for k in range(11)])
    samples = sample_by_inverse_cdf(pmf, rng.uniform(size=20000))
    mean = float(np.mean(samples))
    assert_close(mean, 5.0, atol=0.05, message=f"sample mean {mean:.3f}, expected 5.0")
