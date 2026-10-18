"""Hidden tests: edge cases, causality and numerical stability.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import math

import numpy as np


def _reference(X, Wq, Wk, Wv):
    """Causal attention for each row in pure Python loops."""
    X = np.asarray(X, dtype=np.float64).tolist()
    Wq = np.asarray(Wq, dtype=np.float64)
    Wk = np.asarray(Wk, dtype=np.float64)
    Wv = np.asarray(Wv, dtype=np.float64)
    d_k = Wq.shape[1]
    rows = []
    for t in range(len(X)):
        q = np.array(X[t]) @ Wq
        scores = []
        values = []
        for s in range(t + 1):
            x_s = np.array(X[s])
            scores.append(float(q @ (x_s @ Wk)) / math.sqrt(d_k))
            values.append(x_s @ Wv)
        m = max(scores)
        exps = [math.exp(v - m) for v in scores]
        total = sum(exps)
        rows.append(sum((e / total) * v for e, v in zip(exps, values)))
    return np.array(rows)


def test_hidden_random_matches_reference():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(5, 3))
    Wq = rng.normal(size=(3, 2))
    Wk = rng.normal(size=(3, 2))
    Wv = rng.normal(size=(3, 4))
    ref = _reference(X, Wq, Wk, Wv)
    assert_close(
        decode_no_cache(X, Wq, Wk, Wv),
        ref,
        atol=1e-9,
        rtol=1e-9,
        message="mismatch on random input, seed 0",
    )
    assert_close(
        decode_with_cache(X, Wq, Wk, Wv),
        ref,
        atol=1e-9,
        rtol=1e-9,
        message="mismatch on random input, seed 0",
    )


def test_hidden_single_token():
    rng = np.random.default_rng(3)
    X = rng.normal(size=(1, 4))
    Wq = rng.normal(size=(4, 2))
    Wk = rng.normal(size=(4, 2))
    Wv = rng.normal(size=(4, 3))
    out = decode_with_cache(X, Wq, Wk, Wv)
    assert out.shape == (1, 3), "mismatch on single-token input, seed 3"
    assert_close(
        out, X @ Wv, atol=1e-9, rtol=1e-9, message="mismatch on single-token input, seed 3"
    )


def test_hidden_d_k_one():
    rng = np.random.default_rng(7)
    X = rng.normal(size=(6, 2))
    Wq = rng.normal(size=(2, 1))
    Wk = rng.normal(size=(2, 1))
    Wv = rng.normal(size=(2, 1))
    assert_close(
        decode_with_cache(X, Wq, Wk, Wv),
        _reference(X, Wq, Wk, Wv),
        atol=1e-9,
        rtol=1e-9,
        message="mismatch with d_k = 1, seed 7",
    )


def test_hidden_large_scores_stay_finite():
    rng = np.random.default_rng(11)
    X = rng.normal(size=(6, 4)) * 300.0
    Wq = rng.normal(size=(4, 4)) * 5.0
    Wk = rng.normal(size=(4, 4)) * 5.0
    Wv = rng.normal(size=(4, 4))
    out = decode_with_cache(X, Wq, Wk, Wv)
    assert np.all(np.isfinite(out)), "non-finite output for large scores, seed 11"
    assert_close(
        out,
        decode_no_cache(X, Wq, Wk, Wv),
        atol=1e-6,
        rtol=1e-6,
        message="mismatch for large scores, seed 11",
    )


def test_hidden_no_future_leak():
    # Output at step t must not change when tokens after t change.
    rng = np.random.default_rng(5)
    X = rng.normal(size=(5, 3))
    Wq = rng.normal(size=(3, 3))
    Wk = rng.normal(size=(3, 3))
    Wv = rng.normal(size=(3, 3))
    X2 = X.copy()
    X2[3:] = rng.normal(size=(2, 3)) * 10.0
    a = decode_with_cache(X, Wq, Wk, Wv)
    b = decode_with_cache(X2, Wq, Wk, Wv)
    assert_close(
        a[:3],
        b[:3],
        atol=1e-12,
        rtol=1e-12,
        message="output changed when only future tokens changed, seed 5",
    )


def test_hidden_inputs_not_mutated():
    rng = np.random.default_rng(9)
    X = rng.normal(size=(4, 3))
    Wq = rng.normal(size=(3, 2))
    Wk = rng.normal(size=(3, 2))
    Wv = rng.normal(size=(3, 2))
    X0, Wq0, Wk0, Wv0 = X.copy(), Wq.copy(), Wk.copy(), Wv.copy()
    decode_with_cache(X, Wq, Wk, Wv)
    decode_no_cache(X, Wq, Wk, Wv)
    assert np.array_equal(X, X0), "input array X was modified, seed 9"
    assert np.array_equal(Wq, Wq0) and np.array_equal(Wk, Wk0), "weights were modified, seed 9"
    assert np.array_equal(Wv, Wv0), "weights were modified, seed 9"
