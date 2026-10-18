"""Decoding with a KV cache: starter code.

Complete `attention_step`, `decode_no_cache` and `decode_with_cache` so that
they match the chapter text. The model is one causal self-attention head:
for every token x_t, the query, key and value are x_t @ Wq, x_t @ Wk, x_t @ Wv.
Scores are scaled by 1 / sqrt(d_k), where d_k = Wq.shape[1].

`decode_with_cache` must give the same result as `decode_no_cache`, but it
must project only the new token at each step and reuse the stored keys and
values of the earlier tokens.
"""

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
    # TODO: compute the scaled scores of q against every key, then the weighted sum of V
    raise NotImplementedError


def decode_no_cache(X, Wq, Wk, Wv):
    """Reference decoding without a cache.

    X: (T, d_model) token vectors. Returns (T, d_v), where row t is the output
    for token t. For every t, Q, K and V are recomputed for the whole prefix X[:t+1]
    and only the last query is used.
    """
    # TODO: loop over t, project the prefix X[:t+1], call attention_step with the last query
    raise NotImplementedError


def decode_with_cache(X, Wq, Wk, Wv):
    """Decoding with a KV cache. Same output as `decode_no_cache`.

    At step t project only token t, append its key and value to the cache,
    and attend the new query to the whole cache.
    Returns (T, d_v).
    """
    # TODO: keep Python lists of keys and values, append the projections of X[t] at each step
    raise NotImplementedError
