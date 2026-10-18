"""Visible tests. `update`, `posterior_mean`, `credible_interval` and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821


def test_update_hand_case():
    # Beta(1, 1) prior, 7 successes in 10 trials -> Beta(8, 4)
    A, B = update(1, 1, 7, 10)
    assert (A, B) == (8, 4), f"expected (8, 4), got {(A, B)}"


def test_update_adds_successes_and_failures():
    A, B = update(2, 8, 7, 10)
    assert (A, B) == (9, 11), f"expected (9, 11), got {(A, B)}"


def test_posterior_mean_hand_case():
    m = posterior_mean(8, 4)
    assert_close(m, 0.6667, atol=1e-3, message=f"expected about 0.667, got {m}")


def test_credible_interval_hand_case():
    # Beta(8, 4): 2.5% and 97.5% quantiles are about 0.390 and 0.891
    lo, hi = credible_interval(8, 4)
    assert_close(
        [lo, hi],
        [0.390, 0.891],
        atol=1e-3,
        message=f"expected about (0.390, 0.891), got ({lo:.4f}, {hi:.4f})",
    )


def test_prior_strength_shifts_interval():
    # Beta(10, 10) prior, 7 successes in 10 trials -> Beta(17, 13): interval about (0.389, 0.736)
    A, B = update(10, 10, 7, 10)
    lo, hi = credible_interval(A, B)
    assert_close(
        [lo, hi],
        [0.389, 0.736],
        atol=1e-3,
        message=f"expected about (0.389, 0.736), got ({lo:.4f}, {hi:.4f})",
    )
