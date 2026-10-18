"""Gradient descent for linear regression: starter code.

Model: prediction = X @ w + b, loss = mean((prediction - y) ** 2).
Complete `gradient` and `gradient_descent` so that they match the chapter text.
"""


def gradient(X, y, w, b):
    """Gradient of the mean squared error with respect to the weights and the bias.

    X: array of shape (N, d), y: array of shape (N,), w: array of shape (d,), b: float.
    Returns (grad_w, grad_b): an array of shape (d,) and a float.
    The loss is L = mean((X @ w + b - y) ** 2).
    """
    raise NotImplementedError


def gradient_descent(X, y, lr, steps):
    """Fits w and b by `steps` updates of gradient descent, starting from w = 0, b = 0.

    lr: learning rate (step size). Returns (w, b): an array of shape (d,) and a float.
    """
    raise NotImplementedError
