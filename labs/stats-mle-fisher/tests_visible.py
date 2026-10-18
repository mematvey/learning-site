"""Visible tests. Helpers `mle_*`, `fisher_*`, `standard_error` and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def _coin_sample(heads, n):
    return np.array([1] * heads + [0] * (n - heads), dtype=float)


def test_bernoulli_mle_is_share_of_heads():
    # 49 heads in 80 flips: the MLE is 49 / 80 = 0.6125
    p_hat = mle_bernoulli(_coin_sample(49, 80))
    assert_close(p_hat, 0.6125, atol=1e-9, message=f"expected 0.6125, got {p_hat}")


def test_bernoulli_standard_error_matches_formula():
    # SE = sqrt(p(1-p)/n) = sqrt(0.6125 * 0.3875 / 80) = 0.05447 (text rounds it to 0.054)
    p_hat = mle_bernoulli(_coin_sample(49, 80))
    se = standard_error(fisher_bernoulli(p_hat), 80)
    expected = np.sqrt(0.6125 * 0.3875 / 80)
    assert_close(se, expected, atol=1e-9, message=f"expected SE {expected:.5f}, got {se:.5f}")


def test_bernoulli_standard_error_small_sample():
    # 6 heads in 8 flips: p_hat = 0.75, SE = sqrt(0.75 * 0.25 / 8) = 0.153
    p_hat = mle_bernoulli(_coin_sample(6, 8))
    se = standard_error(fisher_bernoulli(p_hat), 8)
    assert_close(se, 0.153, atol=1e-3, message=f"expected SE about 0.153, got {se:.4f}")


def test_bernoulli_fisher_at_half():
    # I(1/2) = 1 / (1/4) = 4
    assert_close(fisher_bernoulli(0.5), 4.0, atol=1e-9, message="expected I(0.5) = 4")


def test_normal_mle_is_sample_mean():
    x = np.array([1.0, 2.0, 3.0, 4.0])
    mu_hat = mle_normal(x)
    assert_close(mu_hat, 2.5, atol=1e-9, message=f"expected 2.5, got {mu_hat}")


def test_normal_fisher_and_standard_error():
    # sigma = 2: I = 1 / 4, and with n = 4 the SE is sigma / sqrt(n) = 1
    assert_close(fisher_normal(2.0), 0.25, atol=1e-9, message="expected I = 0.25 for sigma = 2")
    se = standard_error(fisher_normal(2.0), 4)
    assert_close(se, 1.0, atol=1e-9, message=f"expected SE 1.0, got {se}")


def test_poisson_mle_and_fisher():
    x = np.array([2.0, 3.0, 1.0, 4.0])
    lam_hat = mle_poisson(x)
    assert_close(lam_hat, 2.5, atol=1e-9, message=f"expected lambda_hat 2.5, got {lam_hat}")
    assert_close(fisher_poisson(2.5), 0.4, atol=1e-9, message="expected I(2.5) = 0.4")


def test_standard_error_shrinks_as_one_over_sqrt_n():
    # Four times the sample size halves the standard error.
    fisher = fisher_poisson(2.5)
    se_small = standard_error(fisher, 10)
    se_big = standard_error(fisher, 40)
    assert_close(
        se_big,
        se_small / 2,
        atol=1e-9,
        message=f"expected SE to halve when n grows 4x, got {se_small:.4f} -> {se_big:.4f}",
    )
