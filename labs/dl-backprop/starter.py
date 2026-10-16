"""Two-layer sigmoid network: forward and backward pass, starter code.

Complete `forward`, `loss` and `backward` so that they match the chapter text.
Batch convention: rows of X, Y, Z1, H and Y_hat are examples.

Network: Z1 = X W1 + b1, H = sigmoid(Z1), Y_hat = H W2 + b2.
Loss: L = sum_i ||y_hat_i - y_i||^2 / (2n).
"""

import numpy as np


def sigmoid(z):
    """Element-wise logistic function, stable for large |z|."""
    z = np.asarray(z, dtype=np.float64)
    # exp is only ever evaluated on non-positive arguments, so it cannot overflow
    e = np.exp(-np.abs(z))
    return np.where(z >= 0, 1.0 / (1.0 + e), e / (1.0 + e))


def forward(X, W1, b1, W2, b2):
    """Forward pass. Returns (Y_hat, (Z1, H)): the output and the values kept for backward."""
    X = np.asarray(X, dtype=np.float64)

    # TODO: compute Z1, H and Y_hat as in the chapter; keep (Z1, H) for the backward pass
    raise NotImplementedError


def loss(Y_hat, Y):
    """Mean squared error with the factor 1/(2n): L = sum ||y_hat_i - y_i||^2 / (2n)."""

    # TODO: return the scalar loss; n is the number of rows (examples)
    raise NotImplementedError


def backward(X, Y, W2, Y_hat, cache):
    """Backward pass. Returns (dW1, db1, dW2, db2) for the loss from `loss`.

    cache is the (Z1, H) pair returned by `forward`.
    """
    X = np.asarray(X, dtype=np.float64)
    # cache[1] is H: use it for sigmoid'(z) = H * (1 - H)

    # TODO: gradient at the output (divide by n), then dW2 and db2
    # TODO: gradient into the hidden layer (sigmoid derivative from H), then dW1 and db1
    raise NotImplementedError
