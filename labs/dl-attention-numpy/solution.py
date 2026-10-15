"""Scaled dot-product attention: reference solution."""

import numpy as np


def attention(Q, K, V, mask=None):
    """Scaled dot-product attention.

    Q: (n, d) queries, K: (m, d) keys, V: (m, d_v) values.
    mask: optional boolean (n, m); True means the query may attend to the key.
    Returns (output, weights): output has shape (n, d_v), weights has shape (n, m).
    Each row of weights sums to 1. A row with no allowed keys gives zeros.
    """
    Q = np.asarray(Q, dtype=np.float64)
    K = np.asarray(K, dtype=np.float64)
    V = np.asarray(V, dtype=np.float64)

    d = Q.shape[-1]
    scores = (Q @ K.T) / np.sqrt(d)
    if mask is not None:
        scores = np.where(np.asarray(mask, dtype=bool), scores, -np.inf)

    # Subtract the row maximum for stability. A fully masked row has max -inf;
    # use 0 there so that exp(-inf) gives zeros instead of NaN.
    row_max = scores.max(axis=-1, keepdims=True)
    row_max = np.where(np.isfinite(row_max), row_max, 0.0)
    exp = np.exp(scores - row_max)
    total = exp.sum(axis=-1, keepdims=True)
    weights = np.divide(exp, total, out=np.zeros_like(exp), where=total > 0)
    output = weights @ V
    return output, weights
