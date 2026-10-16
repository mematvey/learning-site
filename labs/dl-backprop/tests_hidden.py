"""Hidden tests: all weights, shapes, batch size, scale and copies of inputs.

Messages are not shown to the reader. The runner reports only names and statuses.
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


def _random_net(seed, n, d0, d1, d2, scale=1.0):
    rng = np.random.default_rng(seed)
    X = rng.normal(size=(n, d0)) * scale
    Y = rng.normal(size=(n, d2))
    W1 = rng.normal(size=(d0, d1))
    b1 = rng.normal(size=d1)
    W2 = rng.normal(size=(d1, d2))
    b2 = rng.normal(size=d2)
    return X, Y, W1, b1, W2, b2


def _check_all_grads(X, Y, W1, b1, W2, b2, seed):
    def f():
        Y_hat, _ = forward(X, W1, b1, W2, b2)
        return loss(Y_hat, Y)

    Y_hat, cache = forward(X, W1, b1, W2, b2)
    grads = backward(X, Y, W2, Y_hat, cache)
    for name, grad, param in zip(("W1", "b1", "W2", "b2"), grads, (W1, b1, W2, b2)):
        assert grad.shape == param.shape, f"mismatch on random input, seed {seed}, {name} shape"
        assert_close(
            grad,
            _numerical_grad(f, param),
            atol=1e-6,
            rtol=1e-5,
            message=f"mismatch on random input, seed {seed}, {name}",
        )


def test_hidden_all_grads_match_numerical():
    _check_all_grads(*_random_net(0, n=5, d0=3, d1=4, d2=2), seed=0)


def test_hidden_rectangular_shapes():
    _check_all_grads(*_random_net(2, n=7, d0=5, d1=2, d2=4), seed=2)


def test_hidden_single_example():
    _check_all_grads(*_random_net(1, n=1, d0=2, d1=3, d2=1), seed=1)


def test_hidden_large_preactivation_stays_finite():
    args = _random_net(5, n=4, d0=3, d1=5, d2=2, scale=100.0)
    X, Y, W1, b1, W2, b2 = args
    Y_hat, cache = forward(X, W1, b1, W2, b2)
    grads = backward(X, Y, W2, Y_hat, cache)
    assert all(np.all(np.isfinite(g)) for g in grads), "non-finite gradient for saturated sigmoid"
    _check_all_grads(*args, seed=5)


def test_hidden_batch_duplication_keeps_gradient():
    # Loss is a mean over examples: stacking the batch with itself must not change gradients
    X, Y, W1, b1, W2, b2 = _random_net(3, n=3, d0=2, d1=4, d2=3)
    Y_hat, cache = forward(X, W1, b1, W2, b2)
    single = backward(X, Y, W2, Y_hat, cache)

    X2 = np.vstack([X, X])
    Y2 = np.vstack([Y, Y])
    Y_hat2, cache2 = forward(X2, W1, b1, W2, b2)
    double = backward(X2, Y2, W2, Y_hat2, cache2)
    for name, a, b in zip(("dW1", "db1", "dW2", "db2"), single, double):
        assert_close(b, a, atol=1e-9, message=f"{name} must not depend on batch duplication")


def test_hidden_zero_second_layer_blocks_first_layer():
    X, Y, W1, b1, W2, b2 = _random_net(4, n=4, d0=3, d1=2, d2=2)
    W2 = np.zeros_like(W2)
    Y_hat, cache = forward(X, W1, b1, W2, b2)
    dW1, db1, _, _ = backward(X, Y, W2, Y_hat, cache)
    assert_close(
        dW1,
        np.zeros_like(W1),
        atol=1e-12,
        message="with W2 = 0 the first-layer weight gradient must be zero",
    )
    assert_close(
        db1,
        np.zeros_like(b1),
        atol=1e-12,
        message="with W2 = 0 the first-layer bias gradient must be zero",
    )


def test_hidden_inputs_not_mutated():
    X, Y, W1, b1, W2, b2 = _random_net(7, n=3, d0=2, d1=3, d2=2)
    saved = [a.copy() for a in (X, Y, W1, b1, W2, b2)]
    Y_hat, cache = forward(X, W1, b1, W2, b2)
    backward(X, Y, W2, Y_hat, cache)
    for name, a, s in zip(("X", "Y", "W1", "b1", "W2", "b2"), (X, Y, W1, b1, W2, b2), saved):
        assert np.array_equal(a, s), f"{name} must not be modified"


def test_hidden_sigmoid_symmetry_and_limits():
    rng = np.random.default_rng(8)
    z = rng.normal(size=(4, 3)) * 5.0
    assert_close(
        sigmoid(-z), 1.0 - sigmoid(z), atol=1e-9, message="sigmoid(-z) must equal 1 - sigmoid(z)"
    )
    edge = sigmoid(np.array([-1000.0, 1000.0]))
    assert np.all(np.isfinite(edge)), "sigmoid must stay finite for |z| = 1000"
    assert_close(edge, [0.0, 1.0], atol=1e-9, message="sigmoid must saturate at 0 and 1")
