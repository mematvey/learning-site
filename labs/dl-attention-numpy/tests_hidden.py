"""Hidden tests: edge cases and numerical stability.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def _reference(Q, K, V, mask=None):
    """Row-by-row reference with explicit scaling and masking."""
    Q = np.asarray(Q, dtype=np.float64)
    K = np.asarray(K, dtype=np.float64)
    V = np.asarray(V, dtype=np.float64)
    d = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(d)
    if mask is not None:
        scores = np.where(mask, scores, -np.inf)
    rows = []
    for row in scores:
        if np.all(np.isneginf(row)):
            rows.append(np.zeros_like(row))
            continue
        e = np.exp(row - row[np.isfinite(row)].max())
        rows.append(e / e.sum())
    weights = np.array(rows)
    return weights @ V, weights


def _close(a, b):
    return np.allclose(a, b, rtol=1e-6, atol=1e-8)


def test_hidden_random_matches_reference():
    rng = np.random.default_rng(0)
    Q = rng.normal(size=(5, 16))
    K = rng.normal(size=(7, 16))
    V = rng.normal(size=(7, 4))
    out, weights = attention(Q, K, V)
    ref_out, ref_w = _reference(Q, K, V)
    assert _close(weights, ref_w) and _close(out, ref_out), "mismatch on random input, seed 0"


def test_hidden_d1():
    rng = np.random.default_rng(2)
    Q = rng.normal(size=(3, 1))
    K = rng.normal(size=(4, 1))
    V = rng.normal(size=(4, 2))
    out, weights = attention(Q, K, V)
    ref_out, ref_w = _reference(Q, K, V)
    assert _close(weights, ref_w) and _close(out, ref_out), "mismatch for d = 1"


def test_hidden_large_d_scaling():
    rng = np.random.default_rng(1)
    Q = rng.normal(size=(4, 64))
    K = rng.normal(size=(6, 64))
    V = rng.normal(size=(6, 3))
    out, weights = attention(Q, K, V)
    ref_out, ref_w = _reference(Q, K, V)
    assert _close(weights, ref_w) and _close(out, ref_out), "mismatch for large d"


def test_hidden_causal_mask():
    rng = np.random.default_rng(3)
    n = 5
    Q = rng.normal(size=(n, 8))
    K = rng.normal(size=(n, 8))
    V = rng.normal(size=(n, 2))
    mask = np.tril(np.ones((n, n), dtype=bool))
    out, weights = attention(Q, K, V, mask=mask)
    ref_out, ref_w = _reference(Q, K, V, mask=mask)
    assert np.all(weights[~mask] == 0.0), "masked positions must have zero weight"
    assert _close(weights, ref_w) and _close(out, ref_out), "mismatch with causal mask"


def test_hidden_fully_masked_row():
    rng = np.random.default_rng(4)
    Q = rng.normal(size=(3, 4))
    K = rng.normal(size=(3, 4))
    V = rng.normal(size=(3, 2))
    mask = np.ones((3, 3), dtype=bool)
    mask[1, :] = False
    out, weights = attention(Q, K, V, mask=mask)
    assert not np.any(np.isnan(out)) and not np.any(np.isnan(weights)), "NaN in output"
    assert np.all(weights[1] == 0.0) and np.all(out[1] == 0.0), "fully masked row must be zero"
    assert np.allclose(weights[[0, 2]].sum(axis=-1), 1.0), "other rows must sum to 1"


def test_hidden_none_mask_equals_all_true():
    rng = np.random.default_rng(5)
    Q = rng.normal(size=(4, 6))
    K = rng.normal(size=(4, 6))
    V = rng.normal(size=(4, 3))
    out_a, w_a = attention(Q, K, V, mask=None)
    out_b, w_b = attention(Q, K, V, mask=np.ones((4, 4), dtype=bool))
    assert _close(w_a, w_b) and _close(out_a, out_b), "mask=None must equal an all-True mask"


def test_hidden_large_logits_stable():
    rng = np.random.default_rng(6)
    Q = rng.normal(size=(3, 4)) * 1000.0
    K = rng.normal(size=(5, 4)) * 1000.0
    V = rng.normal(size=(5, 2))
    out, weights = attention(Q, K, V)
    assert np.all(np.isfinite(out)) and np.all(np.isfinite(weights)), "non-finite values"
    assert np.allclose(weights.sum(axis=-1), 1.0, atol=1e-6), "rows must sum to 1"


def test_hidden_inputs_not_mutated():
    rng = np.random.default_rng(7)
    Q = rng.normal(size=(2, 3))
    K = rng.normal(size=(2, 3))
    V = rng.normal(size=(2, 3))
    Q_copy = Q.copy()
    attention(Q, K, V)
    assert np.array_equal(Q, Q_copy), "input Q must not be modified"
