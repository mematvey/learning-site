"""Hidden tests: exact quantiles, edge cases and monotonicity.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821


def test_hidden_update_zero_successes():
    assert update(2, 3, 0, 5) == (2, 8), "k = 0 must add only failures"


def test_hidden_update_all_successes():
    assert update(2, 3, 5, 5) == (7, 3), "k = n must add only successes"


def test_hidden_posterior_mean_reference():
    assert_close(posterior_mean(17, 13), 17 / 30, atol=1e-12, rtol=0, message="posterior mean")


def test_hidden_interval_reference_8_4():
    lo, hi = credible_interval(8, 4)
    assert_close(
        [lo, hi],
        [0.390257440, 0.890736556],
        atol=2e-6,
        rtol=0,
        message="credible interval for Beta(8, 4)",
    )


def test_hidden_interval_reference_9_11():
    lo, hi = credible_interval(9, 11)
    assert_close(
        [lo, hi],
        [0.244474689, 0.665002156],
        atol=2e-6,
        rtol=0,
        message="credible interval for Beta(9, 11)",
    )


def test_hidden_interval_reference_17_13():
    lo, hi = credible_interval(17, 13)
    assert_close(
        [lo, hi],
        [0.389362791, 0.735544696],
        atol=2e-6,
        rtol=0,
        message="credible interval for Beta(17, 13)",
    )


def test_hidden_interval_reference_large_counts():
    lo, hi = credible_interval(101, 91)
    assert_close(
        [lo, hi],
        [0.455418201, 0.596151126],
        atol=2e-6,
        rtol=0,
        message="credible interval for Beta(101, 91)",
    )


def test_hidden_interval_tails_match_cdf():
    # Each bound should carry exactly the tail probability of the level.
    lo, hi = credible_interval(1001, 1000, level=0.5)
    assert_close(
        [beta_cdf(lo, 1001, 1000), beta_cdf(hi, 1001, 1000)],
        [0.25, 0.75],
        atol=1e-7,
        rtol=0,
        message="50% interval bounds must sit at the 25% and 75% CDF",
    )


def test_hidden_interval_contains_mean_and_width_shrinks():
    widths = []
    for n in (10, 100, 1000):
        k = int(0.7 * n)
        A, B = update(1, 1, k, n)
        lo, hi = credible_interval(A, B)
        assert 0.0 <= lo < posterior_mean(A, B) < hi <= 1.0, "interval must bracket the mean"
        widths.append(hi - lo)
    assert widths[0] > widths[1] > widths[2], f"interval must narrow with n, got {widths}"
