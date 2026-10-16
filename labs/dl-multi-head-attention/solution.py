"""Multi-head attention: reference solution."""

import numpy as np


def split_heads(X, h):
    """Split a (n, d_model) matrix into h heads.

    Returns an array of shape (h, n, d_k) with d_k = d_model // h.
    Raise ValueError if d_model is not divisible by h.
    """
    X = np.asarray(X, dtype=np.float64)
    n, d_model = X.shape
    if h < 1 or d_model % h != 0:
        raise ValueError(f"d_model={d_model} must be divisible by h={h}")
    d_k = d_model // h
    return X.reshape(n, h, d_k).transpose(1, 0, 2)


def merge_heads(H):
    """Inverse of split_heads: (h, n, d_k) -> (n, h * d_k)."""
    H = np.asarray(H, dtype=np.float64)
    h, n, d_k = H.shape
    return H.transpose(1, 0, 2).reshape(n, h * d_k)


def multi_head_attention(X, W_q, W_k, W_v, W_o, h):
    """Multi-head self-attention.

    X: (n, d_model); W_q, W_k, W_v, W_o: (d_model, d_model); h: number of heads.
    Returns (output, weights): output has shape (n, d_model), weights has shape (h, n, n).
    """
    X = np.asarray(X, dtype=np.float64)
    W_q = np.asarray(W_q, dtype=np.float64)
    W_k = np.asarray(W_k, dtype=np.float64)
    W_v = np.asarray(W_v, dtype=np.float64)
    W_o = np.asarray(W_o, dtype=np.float64)

    Q = split_heads(X @ W_q, h)
    K = split_heads(X @ W_k, h)
    V = split_heads(X @ W_v, h)

    d_k = Q.shape[-1]
    scores = Q @ K.transpose(0, 2, 1) / np.sqrt(d_k)
    shifted = scores - scores.max(axis=-1, keepdims=True)
    exp = np.exp(shifted)
    weights = exp / exp.sum(axis=-1, keepdims=True)

    heads = weights @ V
    output = merge_heads(heads) @ W_o
    return output, weights
