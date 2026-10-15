"""Scaled dot-product attention: starter code.

Complete `attention` so that it matches the chapter text.
"""

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

    # TODO: scale the scores by 1 / sqrt(d)
    scores = Q @ K.T

    # TODO: positions where mask is False must receive zero weight
    shifted = scores - scores.max(axis=-1, keepdims=True)
    exp = np.exp(shifted)
    weights = exp / exp.sum(axis=-1, keepdims=True)
    output = weights @ V
    return output, weights
