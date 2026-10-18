"""Decoding with a KV cache: reference solution."""

import numpy as np


def softmax(x):
    """Numerically stable softmax over a 1-D array."""
    x = np.asarray(x, dtype=np.float64)
    shifted = x - x.max()
    exp = np.exp(shifted)
    return exp / exp.sum()


def attention_step(q, K, V):
    """Attention output for one query over the keys and values seen so far.

    q: (d_k,) query vector. K: (t, d_k) keys. V: (t, d_v) values, t >= 1.
    Returns a vector of shape (d_v,): softmax(K @ q / sqrt(d_k)) @ V.
    """
    q = np.asarray(q, dtype=np.float64)
    K = np.asarray(K, dtype=np.float64)
    V = np.asarray(V, dtype=np.float64)
    scores = K @ q / np.sqrt(q.shape[0])
    return softmax(scores) @ V


def decode_no_cache(X, Wq, Wk, Wv):
    """Reference decoding without a cache: recompute the whole prefix at every step."""
    X = np.asarray(X, dtype=np.float64)
    outputs = []
    for t in range(X.shape[0]):
        prefix = X[: t + 1]
        Q = prefix @ Wq
        K = prefix @ Wk
        V = prefix @ Wv
        outputs.append(attention_step(Q[t], K, V))
    return np.stack(outputs)


def decode_with_cache(X, Wq, Wk, Wv):
    """Decoding with a KV cache: project only the new token and reuse stored keys and values."""
    X = np.asarray(X, dtype=np.float64)
    k_cache = []
    v_cache = []
    outputs = []
    for x in X:
        k_cache.append(x @ Wk)
        v_cache.append(x @ Wv)
        q = x @ Wq
        outputs.append(attention_step(q, np.stack(k_cache), np.stack(v_cache)))
    return np.stack(outputs)
