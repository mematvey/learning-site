"""Softmax and log-softmax: reference solution."""

import numpy as np


def softmax(x, axis=-1):
    """Numerically stable softmax along `axis`.

    x: real array of finite logits. Returns an array of the same shape whose
    slices along `axis` are non-negative and sum to 1.
    """
    x = np.asarray(x, dtype=np.float64)
    # Subtracting the maximum does not change the result (shift invariance)
    # but keeps every exponent <= 0, so exp cannot overflow.
    shifted = x - x.max(axis=axis, keepdims=True)
    exp = np.exp(shifted)
    return exp / exp.sum(axis=axis, keepdims=True)


def log_softmax(x, axis=-1):
    """Stable log-softmax along `axis`: x - logsumexp(x) without log(0)."""
    x = np.asarray(x, dtype=np.float64)
    shifted = x - x.max(axis=axis, keepdims=True)
    log_norm = np.log(np.exp(shifted).sum(axis=axis, keepdims=True))
    return shifted - log_norm
