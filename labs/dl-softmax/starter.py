"""Softmax and log-softmax: starter code.

Complete `softmax` and `log_softmax` so that they match the chapter text.
Both take a real array of logits and an `axis`, and both must be stable
for large logits.
"""

import numpy as np


def softmax(x, axis=-1):
    """Numerically stable softmax along `axis`.

    x: real array of finite logits. Returns an array of the same shape whose
    slices along `axis` are non-negative and sum to 1.
    """
    x = np.asarray(x, dtype=np.float64)

    # TODO: subtract the maximum along `axis` (keepdims=True) before exp
    exp = np.exp(x)
    return exp / exp.sum(axis=axis, keepdims=True)


def log_softmax(x, axis=-1):
    """Stable log-softmax along `axis`: x - logsumexp(x) without log(0)."""
    x = np.asarray(x, dtype=np.float64)

    # TODO: compute x - logsumexp(x) along `axis` without taking log of softmax
    return np.log(softmax(x, axis=axis))
