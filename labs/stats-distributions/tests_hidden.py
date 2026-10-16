"""Hidden tests: edge cases, scale and numerical stability.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def test_hidden_binom_edge_cases():
    assert_close(binom_pmf(0, 5, 0.0), 1.0, atol=1e-6, message="edge case")
    assert_close(binom_pmf(3, 5, 0.0), 0.0, atol=1e-6, message="edge case")
    assert_close(binom_pmf(5, 5, 1.0), 1.0, atol=1e-6, message="edge case")
    assert_close(binom_pmf(-1, 5, 0.5), 0.0, atol=1e-6, message="edge case")
    assert_close(binom_pmf(6, 5, 0.5), 0.0, atol=1e-6, message="edge case")


def test_hidden_binom_large_n_is_finite_and_normalized():
    # n = 1500: math.comb(1500, 750) does not fit a float, so the naive product overflows.
    n, p = 1500, 0.5
    pmf = np.array([binom_pmf(k, n, p) for k in range(n + 1)])
    assert np.all(np.isfinite(pmf)), "non-finite PMF for large n"
    assert_close(pmf.sum(), 1.0, atol=1e-6, message="PMF must sum to 1")
    # Local CLT: the peak is close to 1 / sqrt(2 pi n p (1 - p)).
    peak = 1.0 / np.sqrt(2.0 * np.pi * n * p * (1.0 - p))
    assert_close(pmf[750], peak, rtol=1e-2, message="peak height mismatch, n = 1500")


def test_hidden_poisson_large_lambda():
    # lam^k overflows a float for k = 500, lam = 500. Stirling: P(X = lam) ~ 1 / sqrt(2 pi lam).
    lam = 500.0
    assert_close(
        poisson_pmf(500, lam),
        1.0 / np.sqrt(2.0 * np.pi * lam),
        rtol=1e-2,
        message="mismatch for large lambda",
    )
    total = sum(poisson_pmf(k, lam) for k in range(1201))
    assert_close(total, 1.0, atol=1e-6, message="PMF must sum to 1 for large lambda")


def test_hidden_normal_pdf_keeps_shape():
    out = normal_pdf(np.zeros((2, 3)), 0.0, 1.0)
    assert out.shape == (2, 3), f"expected shape (2, 3), got {out.shape}"
    assert_close(
        out,
        np.full((2, 3), 1.0 / np.sqrt(2.0 * np.pi)),
        atol=1e-6,
        message="vectorized density mismatch",
    )


def test_hidden_inverse_cdf_poisson_moments():
    # Fixed seed 1. Pois(3): mean 3, variance 3, P(X = 0) = e^-3.
    rng = np.random.default_rng(1)
    pmf = np.array([poisson_pmf(k, 3.0) for k in range(31)])
    samples = sample_by_inverse_cdf(pmf, rng.uniform(size=50000))
    mean = float(np.mean(samples))
    var = float(np.var(samples))
    zero_freq = float(np.mean(samples == 0))
    assert_close(mean, 3.0, atol=0.05, message="mean mismatch, seed 1")
    assert_close(var, 3.0, atol=0.1, message="variance mismatch, seed 1")
    assert_close(zero_freq, np.exp(-3.0), atol=0.01, message="P(X = 0) mismatch, seed 1")


def test_hidden_inverse_cdf_scalar_and_bounds():
    pmf = np.array([0.25, 0.25, 0.5])
    assert int(sample_by_inverse_cdf(pmf, 0.0)) == 0, "u = 0 must map to the first value"
    assert int(sample_by_inverse_cdf(pmf, 0.999999)) == 2, "u near 1 must map to the last value"


def test_hidden_inverse_cdf_rounding_leftover():
    # Total mass is 0.5 (not 1): u above the mass must still return a valid index.
    result = int(sample_by_inverse_cdf([0.2, 0.3], 0.9))
    assert result == 1, f"expected the last index 1, got {result}"
