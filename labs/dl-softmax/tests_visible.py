"""Visible tests. `softmax`, `log_softmax` and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def test_output_shape_and_rows_sum_to_one():
    x = np.arange(15, dtype=float).reshape(3, 5) * 0.1
    p = softmax(x)
    assert p.shape == (3, 5), f"expected output shape (3, 5), got {p.shape}"
    assert_close(p.sum(axis=-1), np.ones(3), atol=1e-6, message="each row must sum to 1")


def test_small_hand_case():
    # softmax([1, 2, 3]) = e^k / (e^1 + e^2 + e^3)
    p = softmax([1.0, 2.0, 3.0])
    expected = [0.09003057, 0.24472847, 0.66524096]
    assert_close(p, expected, atol=1e-6, message=f"expected {expected}, got {p.tolist()}")


def test_large_logits_do_not_overflow():
    # Shifting by 1000 leaves the answer unchanged; a naive exp(1000) overflows to inf.
    p = softmax([1000.0, 1001.0, 1002.0])
    expected = [0.09003057, 0.24472847, 0.66524096]
    assert np.all(np.isfinite(p)), f"non-finite output for large logits: {p.tolist()}"
    assert_close(p, expected, atol=1e-6, message="large logits must give the same probabilities")


def test_log_softmax_hand_case():
    # log_softmax([1, 2, 3]) = x - logsumexp(x), logsumexp = 3 + log(1 + e^-1 + e^-2)
    ls = log_softmax([1.0, 2.0, 3.0])
    expected = [-2.40760596, -1.40760596, -0.40760596]
    assert_close(ls, expected, atol=1e-6, message=f"expected {expected}, got {ls.tolist()}")
    assert_close(np.exp(ls).sum(), 1.0, atol=1e-6, message="exp(log_softmax) must sum to 1")
