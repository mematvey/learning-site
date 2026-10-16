"""Hidden tests: edge cases, scale and numerical stability.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import math

import numpy as np


def _reference(x):
    """Row-by-row softmax over the last axis in pure Python."""
    rows = []
    for row in np.asarray(x, dtype=np.float64).tolist():
        m = max(row)
        exps = [math.exp(v - m) for v in row]
        total = sum(exps)
        rows.append([e / total for e in exps])
    return np.array(rows)


def test_hidden_random_matches_reference():
    rng = np.random.default_rng(0)
    x = rng.normal(size=(6, 5)) * 2.0
    assert_close(softmax(x), _reference(x), atol=1e-6, rtol=1e-5,
                 message="mismatch on random input, seed 0")


def test_hidden_axis0_matches_transposed():
    rng = np.random.default_rng(1)
    x = rng.normal(size=(4, 7))
    assert_close(softmax(x, axis=0), softmax(x.T).T, atol=1e-6,
                 message="axis=0 must normalize over columns")


def test_hidden_shift_invariance():
    rng = np.random.default_rng(2)
    x = rng.normal(size=(3, 6))
    base_p = softmax(x)
    base_ls = log_softmax(x)
    for c in (500.0, -300.0):
        assert_close(softmax(x + c), base_p, atol=1e-6,
                     message="softmax must be invariant to adding a constant")
        assert_close(log_softmax(x + c), base_ls, atol=1e-6,
                     message="log_softmax must be invariant to adding a constant")


def test_hidden_huge_logits_stay_finite():
    rng = np.random.default_rng(3)
    x = rng.normal(size=(3, 8)) * 1e4
    p = softmax(x)
    ls = log_softmax(x)
    assert np.all(np.isfinite(p)) and np.all(np.isfinite(ls)), "non-finite values"
    assert_close(p.sum(axis=-1), np.ones(3), atol=1e-6, message="rows must sum to 1")
    assert_close(np.exp(ls).sum(axis=-1), np.ones(3), atol=1e-6,
                 message="exp(log_softmax) must sum to 1")
    assert np.all(ls <= 1e-12), "log-probabilities must be <= 0"


def test_hidden_equal_logits_give_uniform():
    x = np.full((2, 4), -1e4)
    assert_close(softmax(x), np.full((2, 4), 0.25), atol=1e-6,
                 message="equal logits must give a uniform distribution")
    assert_close(log_softmax(x), np.full((2, 4), math.log(0.25)), atol=1e-6,
                 message="equal logits must give log(1/n)")


def test_hidden_single_element():
    assert_close(softmax([5.0]), [1.0], atol=1e-9, message="one logit must give probability 1")
    assert_close(log_softmax([5.0]), [0.0], atol=1e-9, message="one logit must give log-prob 0")


def test_hidden_log_softmax_matches_reference():
    rng = np.random.default_rng(4)
    x = rng.normal(size=(5, 6)) * 3.0
    assert_close(log_softmax(x), np.log(_reference(x)), atol=1e-6,
                 message="log_softmax must match log of the reference softmax")


def test_hidden_inputs_not_mutated():
    rng = np.random.default_rng(7)
    x = rng.normal(size=(2, 3))
    x_copy = x.copy()
    softmax(x)
    log_softmax(x)
    assert np.array_equal(x, x_copy), "input must not be modified"
