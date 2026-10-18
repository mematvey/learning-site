"""Visible tests. `norm_ppf`, `sample_size_per_group`, `power`, `bonferroni_z`,
`peeking_false_positive_rate` and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821


def test_norm_ppf_known_quantiles():
    assert_close(norm_ppf(0.975), 1.959964, atol=1e-5, message="norm_ppf(0.975) must be about 1.96")
    assert_close(norm_ppf(0.8), 0.841621, atol=1e-5, message="norm_ppf(0.8) must be about 0.84")


def test_sample_size_small_effect():
    # delta = 0.2 sigma: n = 2 (1.96 + 0.84)^2 / 0.2^2 = 392.4, rounded up
    n = sample_size_per_group(1.0, 0.2)
    assert n == 393, f"expected 393 users per group, got {n}"


def test_sample_size_half_sigma_effect():
    # delta = 0.5 sigma: n = 62.8, rounded up
    n = sample_size_per_group(1.0, 0.5)
    assert n == 63, f"expected 63 users per group, got {n}"


def test_sample_size_quarter_rule():
    # Halving the effect multiplies the sample size by four (1570 is about 4 * 393)
    n = sample_size_per_group(1.0, 0.1)
    assert n == 1570, f"expected 1570 users per group for delta = 0.1 sigma, got {n}"


def test_power_at_planned_sample_size():
    p = power(393, 1.0, 0.2)
    assert_close(
        p,
        0.80,
        atol=0.01,
        message=f"power at the planned sample size must be about 0.80, got {p:.4f}",
    )


def test_bonferroni_ten_checks():
    z = bonferroni_z(10)
    assert_close(
        z,
        2.81,
        atol=0.01,
        message=f"Bonferroni critical value for 10 checks must be about 2.81, got {z:.4f}",
    )


def test_peeking_one_look_is_near_five_percent():
    rate = peeking_false_positive_rate(1)
    assert 0.04 <= rate <= 0.06, f"one look must give a rate near 0.05, got {rate:.4f}"
