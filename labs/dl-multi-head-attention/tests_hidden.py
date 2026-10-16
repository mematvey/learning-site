"""Hidden tests: edge cases, reference comparison and numerical stability.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def _reference(X, W_q, W_k, W_v, W_o, h):
    """Head-by-head loop over column slices; independent of split_heads/merge_heads."""
    X = np.asarray(X, dtype=np.float64)
    d_model = X.shape[1]
    d_k = d_model // h
    Q, K, V = X @ W_q, X @ W_k, X @ W_v
    outs, ws = [], []
    for i in range(h):
        sl = slice(i * d_k, (i + 1) * d_k)
        s = Q[:, sl] @ K[:, sl].T / np.sqrt(d_k)
        w = np.exp(s - s.max(axis=1, keepdims=True))
        w = w / w.sum(axis=1, keepdims=True)
        ws.append(w)
        outs.append(w @ V[:, sl])
    return np.concatenate(outs, axis=1) @ W_o, np.stack(ws)


def _close(a, b):
    return np.allclose(a, b, rtol=1e-6, atol=1e-8)


def test_hidden_random_matches_reference():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(5, 16))
    W = [rng.normal(size=(16, 16)) / 4.0 for _ in range(4)]
    out, weights = multi_head_attention(X, *W, h=4)
    ref_out, ref_w = _reference(X, *W, h=4)
    assert _close(weights, ref_w) and _close(out, ref_out), "mismatch on random input, seed 0"


def test_hidden_one_head_per_dimension():
    rng = np.random.default_rng(1)
    X = rng.normal(size=(4, 6))
    W = [rng.normal(size=(6, 6)) for _ in range(4)]
    out, weights = multi_head_attention(X, *W, h=6)
    ref_out, ref_w = _reference(X, *W, h=6)
    assert _close(weights, ref_w) and _close(out, ref_out), "mismatch for h = d_model"


def test_hidden_h1_matches_reference():
    rng = np.random.default_rng(9)
    X = rng.normal(size=(4, 8))
    W = [rng.normal(size=(8, 8)) / np.sqrt(8) for _ in range(4)]
    out, weights = multi_head_attention(X, *W, h=1)
    ref_out, ref_w = _reference(X, *W, h=1)
    assert _close(weights, ref_w) and _close(out, ref_out), "mismatch for h = 1"


def test_hidden_split_merge_roundtrip_random():
    rng = np.random.default_rng(2)
    X = rng.normal(size=(5, 12))
    H = split_heads(X, 3)
    for i in range(3):
        cols = X[:, i * 4:(i + 1) * 4]
        assert _close(H[i], cols), f"head {i} must take columns {i * 4} to {i * 4 + 3}"
    assert _close(merge_heads(H), X), "merge_heads(split_heads(X, 3)) must equal X"


def test_hidden_split_rejects_indivisible():
    X = np.zeros((4, 10))
    try:
        split_heads(X, 3)
    except ValueError:
        return
    assert False, "split_heads must raise ValueError when d_model is not divisible by h"


def test_hidden_large_inputs_stable():
    rng = np.random.default_rng(3)
    X = rng.normal(size=(4, 8)) * 1000.0
    W = [rng.normal(size=(8, 8)) for _ in range(4)]
    out, weights = multi_head_attention(X, *W, h=2)
    assert np.all(np.isfinite(out)) and np.all(np.isfinite(weights)), "non-finite values"
    assert np.allclose(weights.sum(axis=-1), 1.0, atol=1e-6), "each row of each head must sum to 1"


def test_hidden_inputs_not_mutated():
    rng = np.random.default_rng(7)
    X = rng.normal(size=(3, 4))
    W = [rng.normal(size=(4, 4)) for _ in range(4)]
    X_copy = X.copy()
    W_copy = [w.copy() for w in W]
    multi_head_attention(X, *W, h=2)
    assert np.array_equal(X, X_copy), "input X must not be modified"
    assert all(np.array_equal(a, b) for a, b in zip(W, W_copy)), "weights must not be modified"
