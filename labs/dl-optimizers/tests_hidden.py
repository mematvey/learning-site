"""Hidden tests: multi-step behaviour, shapes, scale, zero gradient, input safety.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import math

import numpy as np


def _reference_adam(theta, grads, lr, beta1=0.9, beta2=0.999, eps=1e-8):
    """Adam over a list of gradient vectors, scalar loops in pure Python."""
    theta = list(map(float, theta))
    m = [0.0] * len(theta)
    v = [0.0] * len(theta)
    for t, g in enumerate(grads, start=1):
        for i, gi in enumerate(g):
            m[i] = beta1 * m[i] + (1 - beta1) * gi
            v[i] = beta2 * v[i] + (1 - beta2) * gi * gi
            m_hat = m[i] / (1 - beta1**t)
            v_hat = v[i] / (1 - beta2**t)
            theta[i] -= lr * m_hat / (math.sqrt(v_hat) + eps)
    return np.array(theta)


def _reference_momentum(theta, grads, lr, beta):
    theta = list(map(float, theta))
    v = [0.0] * len(theta)
    for g in grads:
        for i, gi in enumerate(g):
            v[i] = beta * v[i] + gi
            theta[i] -= lr * v[i]
    return np.array(theta)


def test_hidden_adam_matches_reference_over_steps():
    rng = np.random.default_rng(0)
    theta0 = rng.normal(size=4)
    grads = [rng.normal(size=4) for _ in range(20)]
    theta, state = theta0, {}
    for g in grads:
        theta, state = adam_step(theta, g, state, lr=0.01)
    assert_close(
        theta,
        _reference_adam(theta0, grads, lr=0.01),
        atol=1e-6,
        rtol=1e-5,
        message="Adam mismatch on random gradients, seed 0",
    )


def test_hidden_momentum_matches_reference_over_steps():
    rng = np.random.default_rng(1)
    theta0 = rng.normal(size=5)
    grads = [rng.normal(size=5) for _ in range(15)]
    theta, state = theta0, {}
    for g in grads:
        theta, state = momentum_step(theta, g, state, lr=0.05, beta=0.8)
    assert_close(
        theta,
        _reference_momentum(theta0, grads, lr=0.05, beta=0.8),
        atol=1e-6,
        rtol=1e-5,
        message="momentum mismatch on random gradients, seed 1",
    )


def test_hidden_adam_constant_gradient_moves_by_lr_each_step():
    # With a constant gradient the bias-corrected moments equal g, so every step is lr * sign(g).
    theta, state = np.zeros(3), {}
    g = np.array([2.0, -0.5, 7.0])
    for _ in range(5):
        theta, state = adam_step(theta, g, state, lr=0.1)
    assert_close(
        theta,
        np.array([-0.5, 0.5, -0.5]),
        atol=1e-5,
        message="constant gradient must move each coordinate by lr per step",
    )


def test_hidden_adam_is_scale_invariant_on_first_step():
    theta0 = np.zeros(2)
    g = np.array([1.0, -3.0])
    small, _ = adam_step(theta0, g, {}, lr=0.01)
    large, _ = adam_step(theta0, g * 1e6, {}, lr=0.01)
    assert_close(
        large, small, atol=1e-6, message="scaling the gradient must not change Adam's step"
    )


def test_hidden_adam_keeps_shape_for_matrices():
    rng = np.random.default_rng(2)
    W = rng.normal(size=(3, 2))
    G = rng.normal(size=(3, 2))
    new_W, state = adam_step(W, G, {}, lr=0.01)
    assert new_W.shape == (3, 2), f"expected shape (3, 2), got {new_W.shape}"
    assert state["m"].shape == (3, 2), f"expected m shape (3, 2), got {state['m'].shape}"
    assert state["v"].shape == (3, 2), f"expected v shape (3, 2), got {state['v'].shape}"


def test_hidden_zero_gradient_keeps_weights():
    theta0 = np.array([0.4, -1.5])
    zero = np.zeros(2)
    for step in (sgd_step, momentum_step, adam_step):
        new_theta, _ = step(theta0, zero, {}, lr=0.1)
        assert np.all(np.isfinite(new_theta)), (
            f"{step.__name__}: non-finite output for zero gradient"
        )
        assert_close(
            new_theta,
            theta0,
            atol=1e-9,
            message=f"{step.__name__}: zero gradient must leave weights unchanged",
        )


def test_hidden_sgd_quadratic_closed_form():
    # On L = 0.5 * (1 * x^2 + 10 * y^2) the gradient is (x, 10 y); each step multiplies by (1 - lr * lambda).
    lam = np.array([1.0, 10.0])
    lr = 0.05
    x0 = np.array([2.0, -1.0])
    theta, state = x0, {}
    for _ in range(20):
        theta, state = sgd_step(theta, lam * theta, state, lr=lr)
    expected = (1 - lr * lam) ** 20 * x0
    assert_close(
        theta, expected, atol=1e-9, message="SGD on a quadratic must follow the closed form"
    )


def test_hidden_inputs_not_mutated():
    rng = np.random.default_rng(3)
    theta = rng.normal(size=3)
    g = rng.normal(size=3)
    theta_copy, g_copy = theta.copy(), g.copy()
    sgd_step(theta, g, {}, lr=0.1)
    momentum_step(theta, g, {}, lr=0.1)
    adam_step(theta, g, {}, lr=0.1)
    assert np.array_equal(theta, theta_copy), "weights must not be modified in place"
    assert np.array_equal(g, g_copy), "gradient must not be modified in place"
