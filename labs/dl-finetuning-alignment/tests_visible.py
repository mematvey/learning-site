"""Visible tests. The functions under test and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def test_output_shapes_single_and_batch():
    W0 = np.zeros((3, 4))
    A = np.ones((2, 4))
    B = np.ones((3, 2))
    h = lora_forward(W0, A, B, np.ones(4))
    assert h.shape == (3,), f"expected output shape (3,), got {h.shape}"
    hb = lora_forward(W0, A, B, np.ones((5, 4)))
    assert hb.shape == (5, 3), f"expected batch output shape (5, 3), got {hb.shape}"


def test_hand_case_without_scale():
    # W0 x = [1, 4]; A x = [3]; B (A x) = [3, 9]; sum = [4, 13]
    W0 = [[1.0, 0.0], [0.0, 2.0]]
    A = [[1.0, 1.0]]
    B = [[1.0], [3.0]]
    x = [1.0, 2.0]
    h = lora_forward(W0, A, B, x)
    expected = [4.0, 13.0]
    assert_close(
        h, expected, atol=1e-9, message=f"expected {expected}, got {np.asarray(h).tolist()}"
    )


def test_alpha_scales_the_update_by_alpha_over_r():
    # Same case as above with r = 1 and alpha = 2: scale = 2, so the update is doubled.
    # W0 x = [1, 4]; update = [6, 18]; h = [7, 22]
    W0 = [[1.0, 0.0], [0.0, 2.0]]
    A = [[1.0, 1.0]]
    B = [[1.0], [3.0]]
    x = [1.0, 2.0]
    h = lora_forward(W0, A, B, x, alpha=2.0)
    expected = [7.0, 22.0]
    assert_close(
        h, expected, atol=1e-9, message=f"expected {expected}, got {np.asarray(h).tolist()}"
    )


def test_zero_b_gives_the_frozen_layer():
    # B starts at zero, so at the beginning of training the output equals W0 x.
    rng = np.random.default_rng(0)
    W0 = rng.normal(size=(4, 6))
    A = rng.normal(size=(2, 6))
    B = np.zeros((4, 2))
    x = rng.normal(size=6)
    assert_close(
        lora_forward(W0, A, B, x, alpha=16.0),
        W0 @ x,
        atol=1e-9,
        message="with B = 0 the output must equal W0 x",
    )


def test_parameter_counts_for_4096_matrix():
    full = count_full_params(4096, 4096)
    assert full == 16_777_216, f"expected 16777216 full parameters, got {full}"
    lora = count_lora_params(4096, 4096, 8)
    assert lora == 65_536, f"expected 65536 LoRA parameters for r = 8, got {lora}"
    frac = trainable_fraction(4096, 4096, 8)
    assert_close(
        frac,
        65_536 / 16_777_216,
        atol=1e-12,
        message=f"expected fraction 65536 / 16777216, got {frac}",
    )
