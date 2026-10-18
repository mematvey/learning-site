"""Online softmax and tiled attention: reference solution.

Each tile contributes its local maximum and local sums. They are merged into
the running state with the rescaling factor exp(old_max - new_max).
"""

import numpy as np


def naive_attention(Q, K, V):
    """Reference attention: softmax(Q K^T / sqrt(d)) V, with the full N x N matrix."""
    d = Q.shape[-1]
    S = Q @ K.T / np.sqrt(d)
    S = S - S.max(axis=-1, keepdims=True)
    P = np.exp(S)
    P = P / P.sum(axis=-1, keepdims=True)
    return P @ V


def online_softmax(scores, block_size):
    """Running maximum m and sum l = sum(exp(x - m)) over tiles of one row."""
    scores = np.asarray(scores, dtype=np.float64)
    m = -np.inf
    l = 0.0
    for start in range(0, scores.shape[0], block_size):
        tile = scores[start : start + block_size]
        m_tile = tile.max()
        l_tile = np.exp(tile - m_tile).sum()
        m_new = max(m, m_tile)
        l = l * np.exp(m - m_new) + l_tile * np.exp(m_tile - m_new)
        m = m_new
    return float(m), float(l)


def tiled_attention(Q, K, V, block_size):
    """Attention output over key/value tiles, exact up to rounding."""
    Q = np.asarray(Q, dtype=np.float64)
    K = np.asarray(K, dtype=np.float64)
    V = np.asarray(V, dtype=np.float64)
    n, d = Q.shape
    scale = 1.0 / np.sqrt(d)
    m = np.full(n, -np.inf)
    l = np.zeros(n)
    a = np.zeros((n, V.shape[1]))
    for start in range(0, K.shape[0], block_size):
        S = Q @ K[start : start + block_size].T * scale
        m_tile = S.max(axis=1)
        P = np.exp(S - m_tile[:, None])
        l_tile = P.sum(axis=1)
        a_tile = P @ V[start : start + block_size]
        m_new = np.maximum(m, m_tile)
        old = np.exp(m - m_new)
        new = np.exp(m_tile - m_new)
        l = l * old + l_tile * new
        a = a * old[:, None] + a_tile * new[:, None]
        m = m_new
    return a / l[:, None]
