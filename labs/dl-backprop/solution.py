"""Two-layer sigmoid network: forward and backward pass, reference solution.

Batch convention: rows of X, Y, Z1, H and Y_hat are examples.
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
    Z1 = X @ W1 + b1
    H = sigmoid(Z1)
    Y_hat = H @ W2 + b2
    return Y_hat, (Z1, H)


def loss(Y_hat, Y):
    """Mean squared error with the factor 1/(2n): L = sum ||y_hat_i - y_i||^2 / (2n)."""
    n = Y_hat.shape[0]
    diff = Y_hat - Y
    return float(np.sum(diff * diff) / (2 * n))


def backward(X, Y, W2, Y_hat, cache):
    """Backward pass. Returns (dW1, db1, dW2, db2) for the loss from `loss`."""
    X = np.asarray(X, dtype=np.float64)
    _, H = cache
    n = X.shape[0]
    # Gradient at the output, scaled by 1/n because the loss is averaged over the batch
    delta2 = (Y_hat - Y) / n
    dW2 = H.T @ delta2
    db2 = delta2.sum(axis=0)
    # Send the gradient into the hidden layer; sigmoid'(z) = H * (1 - H) uses the saved H
    delta1 = (delta2 @ W2.T) * H * (1.0 - H)
    dW1 = X.T @ delta1
    db1 = delta1.sum(axis=0)
    return dW1, db1, dW2, db2
