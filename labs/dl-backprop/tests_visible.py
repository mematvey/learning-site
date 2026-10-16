"""Visible tests. `forward`, `loss`, `backward`, `sigmoid` and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
forward returns (Y_hat, (Z1, H)); backward returns (dW1, db1, dW2, db2).
"""

# ruff: noqa: F821
import numpy as np


def _numerical_grad(f, w, eps=1e-5):
    """Central differences over every entry of w; w is changed in place and restored."""
    grad = np.zeros_like(w)
    for idx in np.ndindex(w.shape):
        old = w[idx]
        w[idx] = old + eps
        f_plus = f()
        w[idx] = old - eps
        f_minus = f()
        w[idx] = old
        grad[idx] = (f_plus - f_minus) / (2 * eps)
    return grad


def _small_net(seed=0):
    rng = np.random.default_rng(seed)
    X = rng.normal(size=(3, 2))
    Y = rng.normal(size=(3, 2))
    W1 = rng.normal(size=(2, 3))
    b1 = rng.normal(size=3)
    W2 = rng.normal(size=(3, 2))
    b2 = rng.normal(size=2)
    return X, Y, W1, b1, W2, b2


def test_sigmoid_hand_values():
    s = sigmoid([0.0, 1e4, -1e4])
    assert np.all(np.isfinite(s)), f"non-finite sigmoid output: {s.tolist()}"
    assert_close(s, [0.5, 1.0, 0.0], atol=1e-6, message="sigmoid(0) = 0.5, saturates at 0 and 1")


def test_forward_shapes():
    X, _, W1, b1, W2, b2 = _small_net()
    Y_hat, (Z1, H) = forward(X, W1, b1, W2, b2)
    assert Y_hat.shape == (3, 2), f"expected Y_hat shape (3, 2), got {Y_hat.shape}"
    assert Z1.shape == (3, 3), f"expected Z1 shape (3, 3), got {Z1.shape}"
    assert H.shape == (3, 3), f"expected H shape (3, 3), got {H.shape}"


def test_forward_zero_weights_hand_case():
    # H = sigmoid(0) = 0.5 everywhere, and Y_hat is just the output bias in every row
    X = np.ones((2, 3))
    W1 = np.zeros((3, 4))
    b1 = np.zeros(4)
    W2 = np.zeros((4, 2))
    b2 = np.array([1.0, -1.0])
    Y_hat, (_, H) = forward(X, W1, b1, W2, b2)
    assert_close(H, np.full((2, 4), 0.5), atol=1e-9, message="H must be sigmoid(0) = 0.5")
    assert_close(
        Y_hat,
        [[1.0, -1.0], [1.0, -1.0]],
        atol=1e-9,
        message="with W2 = 0, every row of Y_hat must equal b2",
    )


def test_loss_hand_case():
    # n = 2 rows, squared errors 1 and 0: L = (1 + 0) / (2 * 2) = 0.25
    Y_hat = np.array([[1.0, 0.0], [0.0, 0.0]])
    Y = np.zeros((2, 2))
    value = loss(Y_hat, Y)
    assert abs(value - 0.25) < 1e-9, f"expected loss 0.25, got {value}"


def test_backward_shapes():
    X, Y, W1, b1, W2, b2 = _small_net()
    Y_hat, cache = forward(X, W1, b1, W2, b2)
    dW1, db1, dW2, db2 = backward(X, Y, W2, Y_hat, cache)
    assert dW1.shape == W1.shape, f"expected dW1 shape {W1.shape}, got {dW1.shape}"
    assert db1.shape == b1.shape, f"expected db1 shape {b1.shape}, got {db1.shape}"
    assert dW2.shape == W2.shape, f"expected dW2 shape {W2.shape}, got {dW2.shape}"
    assert db2.shape == b2.shape, f"expected db2 shape {b2.shape}, got {db2.shape}"


def test_output_layer_gradient_matches_numerical():
    X, Y, W1, b1, W2, b2 = _small_net()

    def f():
        Y_hat, _ = forward(X, W1, b1, W2, b2)
        return loss(Y_hat, Y)

    Y_hat, cache = forward(X, W1, b1, W2, b2)
    _, _, dW2, db2 = backward(X, Y, W2, Y_hat, cache)
    assert_close(
        dW2, _numerical_grad(f, W2), atol=1e-6, message="dW2 differs from the numerical gradient"
    )
    assert_close(
        db2, _numerical_grad(f, b2), atol=1e-6, message="db2 differs from the numerical gradient"
    )


def test_hidden_layer_gradient_matches_numerical():
    X, Y, W1, b1, W2, b2 = _small_net()

    def f():
        Y_hat, _ = forward(X, W1, b1, W2, b2)
        return loss(Y_hat, Y)

    Y_hat, cache = forward(X, W1, b1, W2, b2)
    dW1, db1, _, _ = backward(X, Y, W2, Y_hat, cache)
    assert_close(
        dW1, _numerical_grad(f, W1), atol=1e-6, message="dW1 differs from the numerical gradient"
    )
    assert_close(
        db1, _numerical_grad(f, b1), atol=1e-6, message="db1 differs from the numerical gradient"
    )
