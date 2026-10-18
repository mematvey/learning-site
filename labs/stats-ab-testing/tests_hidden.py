"""Hidden tests: scaling laws, monotonicity and simulation stability.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import itertools
import math


def test_hidden_sample_size_scales_with_inverse_square_of_effect():
    n1 = sample_size_per_group(1.0, 0.3)
    n2 = sample_size_per_group(1.0, 0.15)
    assert abs(n2 - 4 * n1) <= 4, "halving delta must multiply n by four"


def test_hidden_sample_size_scales_with_variance():
    n1 = sample_size_per_group(1.0, 0.3)
    n2 = sample_size_per_group(2.0, 0.3)
    assert abs(n2 - 4 * n1) <= 4, "doubling sigma must multiply n by four"


def test_hidden_higher_power_needs_more_users():
    n80 = sample_size_per_group(1.0, 0.2, target_power=0.8)
    n90 = sample_size_per_group(1.0, 0.2, target_power=0.9)
    assert n90 > n80, "a higher target power must need more users"


def test_hidden_power_grows_with_sample_size():
    values = [power(n, 1.0, 0.2) for n in (50, 100, 200, 400, 800)]
    assert all(a < b for a, b in itertools.pairwise(values)), "power must grow with n"
    planned = sample_size_per_group(1.0, 0.2)
    assert power(planned, 1.0, 0.2) >= 0.79, "power at the planned size must be about 0.8"


def test_hidden_stricter_alpha_lowers_power():
    assert power(393, 1.0, 0.2, alpha=0.01) < power(393, 1.0, 0.2), (
        "a stricter alpha must lower power at the same n"
    )


def test_hidden_bonferroni_limits():
    assert_close(
        bonferroni_z(1),
        norm_ppf(0.975),
        atol=1e-9,
        message="one comparison must give the usual critical value",
    )
    zs = [bonferroni_z(k) for k in (1, 2, 5, 10, 50)]
    assert all(a < b for a, b in itertools.pairwise(zs)), "critical value must grow with k"


def test_hidden_ppf_inverts_cdf():
    for i in range(-30, 31):
        z = i / 10.0
        back = norm_ppf(norm_cdf(z))
        assert abs(back - z) < 1e-6, f"norm_ppf(norm_cdf(z)) must return z, got {back}"


def test_hidden_ten_looks_inflate_error():
    rate = peeking_false_positive_rate(10)
    assert 0.17 <= rate <= 0.21, f"ten looks: rate outside the expected range, got {rate:.4f}"


def test_hidden_simulation_is_reproducible():
    first = peeking_false_positive_rate(10, seed=0)
    second = peeking_false_positive_rate(10, seed=0)
    assert first == second, "the same seed must give the same rate"
    assert 0.0 <= first <= 1.0 and not math.isnan(first), "rate must be a probability"
