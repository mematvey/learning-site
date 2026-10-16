"""Visible tests. `multi_head_attention`, `split_heads`, `merge_heads` and `report_array`
are provided by the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def _single_head_reference(X, W_q, W_k, W_v, W_o):
    """One head of width d_model: softmax(X W_q (X W_k)^T / sqrt(d)) X W_v W_o."""
    Q, K, V = X @ W_q, X @ W_k, X @ W_v
    scores = Q @ K.T / np.sqrt(Q.shape[-1])
    w = np.exp(scores - scores.max(axis=-1, keepdims=True))
    w = w / w.sum(axis=-1, keepdims=True)
    return (w @ V) @ W_o


def _random_weights(rng, d_model):
    return [rng.normal(size=(d_model, d_model)) / np.sqrt(d_model) for _ in range(4)]


def test_output_shapes():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(4, 8))
    W_q, W_k, W_v, W_o = _random_weights(rng, 8)
    out, weights = multi_head_attention(X, W_q, W_k, W_v, W_o, h=2)
    assert out.shape == (4, 8), f"expected output shape (4, 8), got {out.shape}"
    assert weights.shape == (2, 4, 4), f"expected weights shape (2, 4, 4), got {weights.shape}"


def test_split_heads_layout():
    # d_model = 4, h = 2: head 0 takes columns 0-1, head 1 takes columns 2-3.
    X = np.arange(8.0).reshape(2, 4)
    H = split_heads(X, 2)
    expected = np.array([[[0.0, 1.0], [4.0, 5.0]], [[2.0, 3.0], [6.0, 7.0]]])
    assert H.shape == (2, 2, 2), f"expected shape (2, 2, 2), got {H.shape}"
    assert np.allclose(H, expected), f"expected {expected.tolist()}, got {H.tolist()}"


def test_merge_heads_inverts_split():
    X = np.arange(12.0).reshape(3, 4)
    merged = merge_heads(split_heads(X, 2))
    assert merged.shape == (3, 4), f"expected shape (3, 4), got {merged.shape}"
    assert np.allclose(merged, X), "merge_heads(split_heads(X, h)) must equal X"


def test_one_head_matches_single_head_attention():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(3, 4))
    W_q, W_k, W_v, W_o = _random_weights(rng, 4)
    out, _ = multi_head_attention(X, W_q, W_k, W_v, W_o, h=1)
    expected = _single_head_reference(X, W_q, W_k, W_v, W_o)
    err = np.abs(out - expected).max()
    assert np.allclose(out, expected, rtol=1e-6, atol=1e-8), (
        f"h=1 must match single-head attention, max abs error {err:.3g}"
    )


def test_report_head_weights_for_heatmap():
    # Passes the per-head weight tensor to the heatmap visualizer.
    rng = np.random.default_rng(0)
    X = rng.normal(size=(4, 8))
    W_q, W_k, W_v, W_o = _random_weights(rng, 8)
    _, weights = multi_head_attention(X, W_q, W_k, W_v, W_o, h=2)
    report_array("weights", weights)
    assert weights.shape == (2, 4, 4), f"expected weights shape (2, 4, 4), got {weights.shape}"
