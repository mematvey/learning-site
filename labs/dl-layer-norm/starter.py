"""LayerNorm and RMSNorm: starter code.

Complete `layer_norm` and `rms_norm` so that they match the chapter text.
Normalization is over the last axis; gamma and beta have shape (d,).
"""

import numpy as np


def layer_norm(x, gamma, beta, eps=1e-5):
    """LayerNorm over the last axis: y = gamma * (x - mean) / sqrt(var + eps) + beta."""
    x = np.asarray(x, dtype=np.float64)
    gamma = np.asarray(gamma, dtype=np.float64)
    beta = np.asarray(beta, dtype=np.float64)

    # TODO: mean and variance must be taken over the last axis (keepdims=True)
    mean = x.mean(axis=0, keepdims=True)
    var = x.var(axis=0, keepdims=True)
    x_hat = (x - mean) / np.sqrt(var + eps)

    # TODO: apply the learned scale and shift: gamma * x_hat + beta
    return x_hat


def rms_norm(x, gamma, eps=1e-5):
    """RMSNorm over the last axis: y = gamma * x / sqrt(mean(x**2) + eps)."""
    x = np.asarray(x, dtype=np.float64)
    gamma = np.asarray(gamma, dtype=np.float64)

    # TODO: divide by the root mean square over the last axis, then scale by gamma
    return x
