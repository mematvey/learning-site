"""Inverted dropout, weight decay and AdamW step: starter code.

Complete the three functions so that they match the chapter text:
- `dropout`: inverted dropout with a training mode (random mask) and an inference mode.
- `weight_decay_step`: one gradient step with weight decay applied to the weights.
- `adamw_step`: one AdamW step, where the decay is separate from the Adam update.

All functions take NumPy arrays and must not modify their inputs.
"""

import numpy as np


def dropout(x, p, training=True, rng=None):
    """Inverted dropout over the elements of `x`.

    x: real array of activations. p: probability of zeroing an element, 0 <= p < 1.
    training=True: sample a keep-mask with keep probability 1 - p and return
    (x * mask / (1 - p), mask). training=False: return (copy of x, mask of ones).
    rng: optional numpy.random.Generator; a fresh default generator is used if None.
    """
    x = np.asarray(x, dtype=np.float64)
    # TODO: validate p (raise ValueError outside [0, 1)), then handle training=False
    # TODO: draw the keep-mask from rng and scale the kept elements by 1 / (1 - p)
    raise NotImplementedError


def weight_decay_step(w, grad, lr, weight_decay):
    """One gradient descent step with weight decay: w <- (1 - lr * wd) * w - lr * grad.

    Returns the new weights as a new array; inputs are not modified.
    """
    # TODO: shrink w by the factor (1 - lr * weight_decay), then subtract lr * grad
    raise NotImplementedError


def adamw_step(w, grad, m, v, t, lr, weight_decay, beta1=0.9, beta2=0.999, eps=1e-8):
    """One AdamW step with decoupled weight decay.

    t is the 1-based step number. m and v are the running first and second moments
    of the gradient. The decay term lr * weight_decay * w is not divided by sqrt(v).
    Returns (w_new, m_new, v_new). Inputs are not modified.
    """
    # TODO: update m and v, correct their bias with 1 - beta**t,
    # TODO: take the Adam step, then subtract the decay term lr * weight_decay * w
    raise NotImplementedError
