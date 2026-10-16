"""SGD, momentum and Adam update rules: starter code.

Each function gets the weights `theta`, the gradient `g` of the loss on the
current minibatch and an optimizer `state` (a dict, empty on the first step).
It returns the new weights and the new state. Do not modify the inputs in place.
"""


def sgd_step(theta, g, state, lr=0.01):
    """One SGD step. Returns (new_theta, state).

    theta: array of weights. g: gradient of the same shape. state: dict, unused by SGD.
    """
    # TODO: move theta against the gradient by lr; return the state unchanged
    raise NotImplementedError


def momentum_step(theta, g, state, lr=0.01, beta=0.9):
    """One momentum step. Returns (new_theta, new_state).

    The velocity is stored under state["v"] and starts at zeros.
    """
    # TODO: update the velocity with the gradient, then move theta by lr * velocity
    raise NotImplementedError


def adam_step(theta, g, state, lr=1e-3, beta1=0.9, beta2=0.999, eps=1e-8):
    """One Adam step. Returns (new_theta, new_state).

    The state keeps the first moment "m", the second moment "v" and the step count "t".
    Both moments start at zeros; apply the bias correction before the update.
    """
    # TODO: update m and v (v uses the elementwise square), correct both for bias,
    # then move theta by lr * m_hat / (sqrt(v_hat) + eps)
    raise NotImplementedError
