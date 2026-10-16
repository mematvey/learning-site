"""Inverted dropout, weight decay and AdamW step: reference solution."""

import numpy as np


def dropout(x, p, training=True, rng=None):
    """Inverted dropout over the elements of `x`.

    x: real array of activations. p: probability of zeroing an element, 0 <= p < 1.
    training=True: sample a keep-mask with keep probability 1 - p and return
    (x * mask / (1 - p), mask). The division keeps the expected output equal to x.
    training=False: return (copy of x, mask of ones), so inference uses the full network.
    rng: optional numpy.random.Generator; a fresh default generator is used if None.
    """
    x = np.asarray(x, dtype=np.float64)
    if not 0.0 <= p < 1.0:
        raise ValueError(f"p must be in [0, 1), got {p}")
    if not training:
        return x.copy(), np.ones_like(x)
    if rng is None:
        rng = np.random.default_rng()
    # An element is kept when a uniform draw in [0, 1) is at least p: P(keep) = 1 - p.
    mask = (rng.random(x.shape) >= p).astype(np.float64)
    return x * mask / (1.0 - p), mask


def weight_decay_step(w, grad, lr, weight_decay):
    """One gradient descent step with weight decay: w <- (1 - lr * wd) * w - lr * grad.

    Returns the new weights as a new array; inputs are not modified.
    """
    w = np.asarray(w, dtype=np.float64)
    grad = np.asarray(grad, dtype=np.float64)
    return (1.0 - lr * weight_decay) * w - lr * grad


def adamw_step(w, grad, m, v, t, lr, weight_decay, beta1=0.9, beta2=0.999, eps=1e-8):
    """One AdamW step with decoupled weight decay.

    t is the 1-based step number. m and v are the running first and second moments
    of the gradient. The decay term lr * weight_decay * w is not divided by sqrt(v).
    Returns (w_new, m_new, v_new). Inputs are not modified.
    """
    w = np.asarray(w, dtype=np.float64)
    grad = np.asarray(grad, dtype=np.float64)
    m_new = beta1 * np.asarray(m, dtype=np.float64) + (1.0 - beta1) * grad
    v_new = beta2 * np.asarray(v, dtype=np.float64) + (1.0 - beta2) * grad * grad
    m_hat = m_new / (1.0 - beta1**t)
    v_hat = v_new / (1.0 - beta2**t)
    adam_update = m_hat / (np.sqrt(v_hat) + eps)
    w_new = w - lr * (adam_update + weight_decay * w)
    return w_new, m_new, v_new
