"""Activations and weight initialization: reference solution."""

import numpy as np

ACTIVATIONS = ("relu", "tanh", "sigmoid")
SCHEMES = ("xavier", "he")


def xavier_init(n_in, n_out, rng):
    """Xavier (Glorot) normal init: weights of shape (n_out, n_in), Var(w) = 2 / (n_in + n_out)."""
    std = np.sqrt(2.0 / (n_in + n_out))
    return rng.normal(0.0, std, size=(n_out, n_in))


def he_init(n_in, n_out, rng):
    """He normal init for ReLU: weights of shape (n_out, n_in), Var(w) = 2 / n_in."""
    std = np.sqrt(2.0 / n_in)
    return rng.normal(0.0, std, size=(n_out, n_in))


def activate(z, kind):
    """Elementwise activation: 'relu', 'tanh' or 'sigmoid'. Raises ValueError otherwise."""
    z = np.asarray(z, dtype=np.float64)
    if kind == "relu":
        return np.maximum(z, 0.0)
    if kind == "tanh":
        return np.tanh(z)
    if kind == "sigmoid":
        # Split by sign so exp never sees a large positive argument.
        e = np.exp(-np.abs(z))
        return np.where(z >= 0, 1.0 / (1.0 + e), e / (1.0 + e))
    raise ValueError(f"unknown activation {kind!r}")


def init_stack(width, depth, scheme, rng):
    """Returns `depth` square weight matrices (width, width) for the chosen scheme."""
    if scheme == "xavier":
        return [xavier_init(width, width, rng) for _ in range(depth)]
    if scheme == "he":
        return [he_init(width, width, rng) for _ in range(depth)]
    raise ValueError(f"unknown scheme {scheme!r}")


def forward_stack(x, weights, kind):
    """Forward pass with zero biases. x has shape (batch, width).

    Layer l computes a_l = activate(a_{l-1} @ W_l.T, kind). Returns the list of
    the L layer outputs a_1, ..., a_L (the input x is not included).
    """
    a = np.asarray(x, dtype=np.float64)
    outputs = []
    for w in weights:
        a = activate(a @ np.asarray(w, dtype=np.float64).T, kind)
        outputs.append(a)
    return outputs


def layer_stats(activations):
    """Mean and variance of each layer's output over all its entries.

    Returns two float arrays of length L: (means, variances), with ddof = 0.
    """
    means = np.array([np.mean(a) for a in activations], dtype=np.float64)
    variances = np.array([np.var(a) for a in activations], dtype=np.float64)
    return means, variances
