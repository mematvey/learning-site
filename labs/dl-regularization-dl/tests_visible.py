"""Visible tests. `dropout`, `weight_decay_step`, `adamw_step`, `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def test_dropout_inference_returns_input():
    x = np.arange(12, dtype=float).reshape(3, 4) - 5.0
    out, _ = dropout(x, 0.5, training=False)
    assert out.shape == x.shape, f"expected shape {x.shape}, got {out.shape}"
    assert_close(out, x, atol=1e-12, rtol=0, message="inference must return the input unchanged")


def test_dropout_training_values_are_zero_or_scaled():
    # Kept elements become x / (1 - p); dropped elements become 0.
    x = np.ones((4, 6))
    p = 0.25
    out, mask = dropout(x, p, rng=np.random.default_rng(0))
    assert out.shape == x.shape, f"expected shape {x.shape}, got {out.shape}"
    assert mask.shape == x.shape, f"expected mask shape {x.shape}, got {mask.shape}"
    allowed = np.isclose(out, 0.0) | np.isclose(out, 1.0 / (1.0 - p))
    assert np.all(allowed), "training output must be 0 or x / (1 - p) for x = 1"


def test_dropout_output_matches_mask():
    x = np.linspace(-2.0, 2.0, 10).reshape(2, 5)
    out, mask = dropout(x, 0.4, rng=np.random.default_rng(1))
    assert_close(out, x * mask / 0.6, atol=1e-9, message="output must equal x * mask / (1 - p)")


def test_weight_decay_hand_case():
    # w <- (1 - 0.1 * 0.01) * w - 0.1 * grad
    w = np.array([1.0, -2.0])
    grad = np.array([0.5, 0.5])
    new_w = weight_decay_step(w, grad, lr=0.1, weight_decay=0.01)
    expected = [0.949, -2.048]
    assert_close(new_w, expected, atol=1e-9, message=f"expected {expected}, got {new_w.tolist()}")


def test_adamw_first_step_hand_case():
    # First step: m_hat = g, v_hat = g^2, so the Adam part is ~ sign(g) = 1.
    # w_new = 2 - 0.1 * (1 + 0.5 * 2) = 1.8
    w_new, m_new, v_new = adamw_step(
        np.array([2.0]),
        np.array([1.0]),
        np.array([0.0]),
        np.array([0.0]),
        t=1,
        lr=0.1,
        weight_decay=0.5,
    )
    assert_close(w_new, [1.8], atol=1e-6, message=f"expected [1.8], got {w_new.tolist()}")
    assert_close(m_new, [0.1], atol=1e-9, message="m after one step must be (1 - beta1) * g")
    assert_close(v_new, [0.001], atol=1e-9, message="v after one step must be (1 - beta2) * g^2")
