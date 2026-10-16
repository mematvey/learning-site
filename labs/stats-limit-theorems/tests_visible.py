"""Visible tests. `sample_means`, `standard_error`, `empirical_standard_error`,
`standardized_means`, `np` and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import math


def _uniform(rng, size):
    return rng.uniform(0.0, 1.0, size)


def test_sample_means_shape():
    means = sample_means(_uniform, n=5, repeats=7, seed=0)
    assert means.shape == (7,), f"expected shape (7,) for 7 repeats, got {means.shape}"


def test_standard_error_hand_case():
    assert_close(
        standard_error(2.0, 4),
        1.0,
        atol=1e-12,
        message="standard_error(2, 4) must be sigma / sqrt(n) = 1",
    )
    assert_close(
        standard_error(1.0, 100), 0.1, atol=1e-12, message="standard_error(1, 100) must be 0.1"
    )


def test_uniform_sd_matches_chapter():
    # One uniform(0, 1) measurement has sd 1/sqrt(12), about 0.289 (chapter, section Code).
    single = sample_means(_uniform, n=1, repeats=20000, seed=0)
    sd = empirical_standard_error(single)
    assert_close(
        sd,
        1 / math.sqrt(12),
        atol=0.005,
        message=f"expected sd of one measurement near 0.289, got {sd:.4f}",
    )


def test_standard_error_n100_matches_chapter():
    # Samples of 100 measurements: standard error about 0.029 (chapter, section Code).
    means = sample_means(_uniform, n=100, repeats=20000, seed=0)
    se = empirical_standard_error(means)
    expected = 1 / math.sqrt(12) / math.sqrt(100)
    assert_close(
        se, expected, atol=0.001, message=f"expected standard error near 0.029, got {se:.4f}"
    )


def test_mean_of_means_close_to_expectation():
    means = sample_means(_uniform, n=100, repeats=20000, seed=0)
    assert_close(
        means.mean(),
        0.5,
        atol=0.01,
        message=f"average of means must be near E[X] = 0.5, got {means.mean():.4f}",
    )


def test_standardized_means_are_centered_and_scaled():
    sigma = 1 / math.sqrt(12)
    means = sample_means(_uniform, n=100, repeats=20000, seed=0)
    z = standardized_means(means, mu=0.5, sigma=sigma, n=100)
    assert_close(z.mean(), 0.0, atol=0.02, message="standardized means must have mean near 0")
    assert_close(z.std(), 1.0, atol=0.02, message="standardized means must have sd near 1")
