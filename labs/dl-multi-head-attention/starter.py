"""Multi-head attention: starter code.

Complete `split_heads`, `merge_heads` and `multi_head_attention` so that they match
the chapter text. Head i uses the columns [i * d_k, (i + 1) * d_k) of the projections.
"""

import numpy as np


def split_heads(X, h):
    """Split a (n, d_model) matrix into h heads.

    Returns an array of shape (h, n, d_k) with d_k = d_model // h.
    Raise ValueError if d_model is not divisible by h.
    """
    # TODO: reshape (n, d_model) to (n, h, d_k), then move the head axis to the front
    raise NotImplementedError


def merge_heads(H):
    """Inverse of split_heads: (h, n, d_k) -> (n, h * d_k)."""
    # TODO: move the head axis back next to d_k, then flatten the last two axes
    raise NotImplementedError


def multi_head_attention(X, W_q, W_k, W_v, W_o, h):
    """Multi-head self-attention.

    X: (n, d_model); W_q, W_k, W_v, W_o: (d_model, d_model); h: number of heads.
    Project X with W_q, W_k, W_v, split into heads, apply scaled dot-product attention
    to each head (scores divided by sqrt(d_k), softmax over the keys), concatenate the
    heads and project with W_o.
    Returns (output, weights): output has shape (n, d_model), weights has shape (h, n, n).
    Use a row-wise maximum subtraction in the softmax for numerical stability.
    """
    X = np.asarray(X, dtype=np.float64)
    W_q = np.asarray(W_q, dtype=np.float64)
    W_k = np.asarray(W_k, dtype=np.float64)
    W_v = np.asarray(W_v, dtype=np.float64)
    W_o = np.asarray(W_o, dtype=np.float64)

    # TODO: project X and split the projections into heads
    # TODO: compute scaled scores per head and the softmax weights
    # TODO: weight the values, merge the heads and apply W_o
    raise NotImplementedError
