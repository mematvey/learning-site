"""Visible tests. `sgd_step`, `momentum_step`, `adam_step` and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def test_sgd_hand_case():
    # theta - lr * g = [1, 2] - 0.1 * [0.5, -1] = [0.95, 2.1]
    theta, _ = sgd_step(np.array([1.0, 2.0]), np.array([0.5, -1.0]), {}, lr=0.1)
    expected = [0.95, 2.1]
    assert_close(theta, expected, atol=1e-6, message=f"expected {expected}, got {theta.tolist()}")


def test_momentum_first_step_is_plain_gradient():
    # With an empty state the velocity is g, so the first step equals an SGD step.
    theta, _ = momentum_step(np.array([1.0, 2.0]), np.array([0.5, -1.0]), {}, lr=0.1)
    expected = [0.95, 2.1]
    assert_close(theta, expected, atol=1e-6, message=f"expected {expected}, got {theta.tolist()}")


def test_momentum_accumulates_velocity():
    # Constant gradient g = 1: v1 = 1, v2 = 0.9 * 1 + 1 = 1.9, so theta drops by lr * (1 + 1.9).
    theta = np.array([0.0])
    g = np.array([1.0])
    theta, state = momentum_step(theta, g, {}, lr=0.1, beta=0.9)
    theta, state = momentum_step(theta, g, state, lr=0.1, beta=0.9)
    expected = [-0.29]
    assert_close(theta, expected, atol=1e-6, message=f"expected {expected}, got {theta.tolist()}")


def test_momentum_beta_zero_matches_sgd():
    theta0 = np.array([0.3, -0.7, 1.2])
    g = np.array([0.1, 0.4, -0.2])
    sgd, _ = sgd_step(theta0, g, {}, lr=0.05)
    mom, _ = momentum_step(theta0, g, {}, lr=0.05, beta=0.0)
    assert_close(mom, sgd, atol=1e-6, message="momentum with beta=0 must match SGD")


def test_adam_first_step_is_about_lr_times_sign():
    # On the first step m_hat = g and v_hat = g^2, so the step is lr * sign(g).
    theta0 = np.array([0.0, 0.0])
    g = np.array([0.3, -5.0])
    theta, _ = adam_step(theta0, g, {}, lr=1e-3)
    expected = [-1e-3, 1e-3]
    assert_close(theta, expected, atol=1e-6, message=f"expected {expected}, got {theta.tolist()}")
