"""Hidden tests: edge cases."""

# ruff: noqa: F821


def test_hidden_no_information():
    assert_close(posterior(0.3, 0.5, 0.5), 0.3, atol=1e-12, message="edge case")


def test_hidden_certain_prior():
    assert_close(posterior(1.0, 0.2, 0.9), 1.0, atol=1e-12, message="edge case")
    assert_close(posterior(0.0, 0.2, 0.9), 0.0, atol=1e-12, message="edge case")


def test_hidden_many_hypotheses():
    res = posterior_many([0.25] * 4, [1.0, 0.0, 0.0, 0.0])
    assert_close(res[0], 1.0, atol=1e-12, message="edge case")


def test_hidden_zero_steps():
    assert_close(update_sequence(0.2, 0.9, 0.1, 0), 0.2, atol=1e-12, message="edge case")


def test_hidden_many_steps():
    assert update_sequence(0.01, 0.9, 0.1, 10) > 0.999
