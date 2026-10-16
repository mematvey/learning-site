"""SGD, momentum and Adam update rules: reference solution."""

import numpy as np


def sgd_step(theta, g, state, lr=0.01):
    """One SGD step: theta - lr * g. The state is returned unchanged."""
    theta = np.asarray(theta, dtype=np.float64)
    g = np.asarray(g, dtype=np.float64)
    return theta - lr * g, state


def momentum_step(theta, g, state, lr=0.01, beta=0.9):
    """One momentum step with velocity v = beta * v + g and theta - lr * v.

    state: dict, empty on the first step. Holds the velocity under key "v".
    Returns (new_theta, new_state).
    """
    theta = np.asarray(theta, dtype=np.float64)
    g = np.asarray(g, dtype=np.float64)
    v = state.get("v", np.zeros_like(theta))
    v = beta * v + g
    return theta - lr * v, {"v": v}


def adam_step(theta, g, state, lr=1e-3, beta1=0.9, beta2=0.999, eps=1e-8):
    """One Adam step with bias-corrected first and second moments.

    state: dict, empty on the first step. Holds "m", "v" (moments) and "t" (step count).
    Returns (new_theta, new_state).
    """
    theta = np.asarray(theta, dtype=np.float64)
    g = np.asarray(g, dtype=np.float64)
    m = state.get("m", np.zeros_like(theta))
    v = state.get("v", np.zeros_like(theta))
    t = state.get("t", 0) + 1

    m = beta1 * m + (1 - beta1) * g
    # Elementwise square: every coordinate keeps its own scale.
    v = beta2 * v + (1 - beta2) * g * g
    m_hat = m / (1 - beta1**t)
    v_hat = v / (1 - beta2**t)
    new_theta = theta - lr * m_hat / (np.sqrt(v_hat) + eps)
    return new_theta, {"m": m, "v": v, "t": t}
