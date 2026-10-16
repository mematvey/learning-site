"""Layer normalization and RMS normalization: reference solution."""

import numpy as np


def layer_norm(x, gamma, beta, eps=1e-5):
    """LayerNorm over the last axis.

    x: (..., d) activations, gamma and beta: (d,) learned scale and shift.
    Returns an array of the same shape as x:
        y = gamma * (x - mean) / sqrt(var + eps) + beta
    where mean and var are taken over the last axis (biased variance).
    """
    x = np.asarray(x, dtype=np.float64)
    gamma = np.asarray(gamma, dtype=np.float64)
    beta = np.asarray(beta, dtype=np.float64)

    mean = x.mean(axis=-1, keepdims=True)
    # Two-pass variance: subtract the mean first, which is stable for large offsets.
    var = ((x - mean) ** 2).mean(axis=-1, keepdims=True)
    x_hat = (x - mean) / np.sqrt(var + eps)
    return gamma * x_hat + beta


def rms_norm(x, gamma, eps=1e-5):
    """RMSNorm over the last axis: no mean subtraction and no shift.

    y = gamma * x / sqrt(mean(x**2) + eps)
    """
    x = np.asarray(x, dtype=np.float64)
    gamma = np.asarray(gamma, dtype=np.float64)

    ms = (x**2).mean(axis=-1, keepdims=True)
    return gamma * x / np.sqrt(ms + eps)
