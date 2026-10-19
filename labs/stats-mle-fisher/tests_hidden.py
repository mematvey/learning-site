"""Hidden tests: random samples, scaling and input checks.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def test_hidden_bernoulli_random_sample():
    rng = np.random.default_rng(0)
    x = (rng.random(200) < 0.3).astype(float)
    assert_close(mle_bernoulli(x), x.mean(), atol=1e-9, message="mismatch on random input, seed 0")


def test_hidden_bernoulli_rejects_non_binary():
    try:
        mle_bernoulli([0.0, 1.0, 2.0])
    except ValueError:
        return
    raise AssertionError("expected ValueError on non-binary input")


def test_hidden_bernoulli_all_zeros_mle():
    assert_close(mle_bernoulli(np.zeros(10)), 0.0, atol=1e-12, message="mismatch on all-zero input")


def test_hidden_fisher_bernoulli_symmetry():
    assert_close(
        fisher_bernoulli(0.1),
        fisher_bernoulli(0.9),
        atol=1e-9,
        message="mismatch: Fisher information must be symmetric in p and 1 - p",
    )


def test_hidden_normal_mle_large_offset():
    rng = np.random.default_rng(0)
    x = 1e6 + rng.normal(size=500)
    assert_close(
        mle_normal(x), x.mean(), atol=1e-6, rtol=1e-12, message="mismatch on random input, seed 0"
    )


def test_hidden_normal_fisher_scales_with_sigma():
    assert_close(
        fisher_normal(3.0) * 9.0, 1.0, atol=1e-9, message="mismatch: I(sigma) must be 1 / sigma**2"
    )


def test_hidden_poisson_random_counts():
    rng = np.random.default_rng(0)
    x = rng.poisson(lam=3.7, size=300).astype(float)
    assert_close(mle_poisson(x), x.mean(), atol=1e-9, message="mismatch on random input, seed 0")


def test_hidden_standard_error_scales_with_n_and_information():
    se = standard_error(0.5, 40)
    assert_close(se, 1.0 / np.sqrt(20.0), atol=1e-9, message="mismatch on standard error, seed 0")
    assert_close(
        standard_error(2.0, 10),
        standard_error(0.5, 10) / 2,
        atol=1e-9,
        message="mismatch: larger information must shrink the standard error",
    )
