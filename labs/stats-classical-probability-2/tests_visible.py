"""Visible tests. The functions and `assert_close` come from the runner."""

# ruff: noqa: F821


def test_posterior_disease():
    p = posterior(0.01, 0.9, 0.1)
    assert_close(p, 9 / 108, atol=1e-9, message=f"expected {9 / 108:.6f}, got {p:.6f}")


def test_posterior_many_factories():
    res = posterior_many([0.5, 0.3, 0.2], [0.01, 0.02, 0.03])
    assert_close(res[2], 6 / 17, atol=1e-9, message=f"third machine: {res[2]:.6f}")
    assert_close(sum(res), 1.0, atol=1e-9, message="posteriors sum to 1")


def test_two_headed_coin():
    # prior 1/3; heads has likelihood 1 for the two-headed coin and 1/2 for a fair one
    assert_close(update_sequence(1 / 3, 1.0, 0.5, 1), 0.5, atol=1e-9, message="after one head")
    assert_close(update_sequence(1 / 3, 1.0, 0.5, 2), 2 / 3, atol=1e-9, message="after two heads")
