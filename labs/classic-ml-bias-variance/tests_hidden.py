"""Hidden tests: edge cases, numerical checks and determinism.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def test_hidden_features_match_vander():
    rng = np.random.default_rng(0)
    x = rng.uniform(-2.0, 2.0, size=7)
    for degree in (0, 4):
        assert_close(
            polynomial_features(x, degree), np.vander(x, degree + 1, increasing=True),
            atol=1e-12, rtol=1e-12, message="features mismatch on random input, seed 0",
        )


def test_hidden_fit_matches_polyfit():
    rng = np.random.default_rng(1)
    x = rng.uniform(0.0, 1.0, size=30)
    y = rng.normal(size=30)
    assert_close(
        fit_poly(x, y, 3), np.polyfit(x, y, 3)[::-1], atol=1e-8, rtol=1e-6,
        message="fit mismatch with reference least squares, seed 1",
    )


def test_hidden_degree_zero_is_mean():
    rng = np.random.default_rng(2)
    x = rng.uniform(0.0, 1.0, size=12)
    y = rng.normal(size=12)
    assert_close(fit_poly(x, y, 0), [y.mean()], atol=1e-10, rtol=1e-10,
                 message="degree 0 must fit the mean of y")


def test_hidden_exact_interpolation():
    rng = np.random.default_rng(3)
    coef = rng.normal(size=5)
    x = np.linspace(-1.0, 1.0, 5)
    y = polynomial_features(x, 4) @ coef
    assert_close(fit_poly(x, y, 4), coef, atol=1e-7, rtol=1e-6,
                 message="exact data must give exact coefficients, seed 3")


def test_hidden_seed_determinism():
    a = bias_variance_estimate(4, 30, seed=7)
    b = bias_variance_estimate(4, 30, seed=7)
    c = bias_variance_estimate(4, 30, seed=8)
    assert a == b, "same seed must give identical results"
    assert a != c, "different seeds must give different results"


def test_hidden_more_data_less_variance():
    _, var_small, _ = bias_variance_estimate(5, 200, n_train=20)
    _, var_large, _ = bias_variance_estimate(5, 200, n_train=40)
    assert var_large < var_small, "variance must drop when n_train grows"


def test_hidden_noise_raises_variance():
    _, var_clean, _ = bias_variance_estimate(3, 200, noise=0.0)
    _, var_noisy, _ = bias_variance_estimate(3, 200, noise=0.6)
    assert var_noisy > var_clean, "noisier labels must give larger variance"
