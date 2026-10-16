"""Hidden tests: edge cases, reproducibility and heavy-tailed data.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import math

import numpy as np


def _uniform(rng, size):
    return rng.uniform(0.0, 1.0, size)


def _exponential(rng, size):
    return rng.exponential(1.0, size)


def _cauchy(rng, size):
    return rng.standard_cauchy(size)


def _iqr(x):
    q75, q25 = np.percentile(x, [75, 25])
    return q75 - q25


def test_hidden_n1_returns_the_draws():
    rng = np.random.default_rng(0)
    expected = rng.uniform(0.0, 1.0, (5, 1)).mean(axis=1)
    got = sample_means(_uniform, n=1, repeats=5, seed=0)
    assert_close(got, expected, atol=1e-12, message="mismatch on n=1, seed 0")


def test_hidden_same_seed_same_result():
    a = sample_means(_uniform, n=10, repeats=50, seed=3)
    b = sample_means(_uniform, n=10, repeats=50, seed=3)
    assert np.array_equal(a, b), "same seed must reproduce the same means"


def test_hidden_different_seed_different_result():
    a = sample_means(_uniform, n=10, repeats=50, seed=3)
    b = sample_means(_uniform, n=10, repeats=50, seed=4)
    assert not np.array_equal(a, b), "different seeds must give different means"


def test_hidden_large_n_standard_error():
    means = sample_means(_uniform, n=10000, repeats=200, seed=1)
    assert means.shape == (200,), "mismatch on shape for large n"
    expected = 1 / math.sqrt(12) / math.sqrt(10000)
    se = empirical_standard_error(means)
    assert_close(se, expected, rtol=0.2, atol=0.0, message="mismatch on large-n standard error")


def test_hidden_standard_error_rejects_bad_n():
    try:
        standard_error(1.0, 0)
    except ValueError:
        return
    raise AssertionError("standard_error must reject n < 1")


def test_hidden_exponential_clt_coverage():
    # Skewed data: the standardized mean of 200 exponentials is close to normal,
    # so about 95% of values fall within +-1.96.
    means = sample_means(_exponential, n=200, repeats=20000, seed=0)
    z = standardized_means(means, mu=1.0, sigma=1.0, n=200)
    frac = float(np.mean(np.abs(z) <= 1.96))
    assert_close(frac, 0.95, atol=0.01, message="mismatch on CLT coverage, seed 0")


def test_hidden_cauchy_means_do_not_concentrate():
    # Cauchy has no mean or variance: the mean of n draws has the same spread as one draw.
    single = sample_means(_cauchy, n=1, repeats=20000, seed=0)
    averaged = sample_means(_cauchy, n=100, repeats=20000, seed=0)
    ratio = _iqr(averaged) / _iqr(single)
    assert_close(ratio, 1.0, atol=0.1, message="spread of Cauchy means must not shrink with n")
