"""Hidden tests: other shapes, scaling and consistency checks.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def test_hidden_scaled_matches_merged_weight():
    rng = np.random.default_rng(0)
    d, k, r = 5, 7, 3
    W0 = rng.normal(size=(d, k))
    A = rng.normal(size=(r, k))
    B = rng.normal(size=(d, r))
    x = rng.normal(size=k)
    expected = (W0 + (5.0 / r) * (B @ A)) @ x
    assert_close(
        lora_forward(W0, A, B, x, alpha=5.0),
        expected,
        atol=1e-9,
        rtol=1e-7,
        message="mismatch on random input, seed 0",
    )


def test_hidden_batch_rows_match_single_vectors():
    rng = np.random.default_rng(1)
    W0 = rng.normal(size=(4, 6))
    A = rng.normal(size=(2, 6))
    B = rng.normal(size=(4, 2))
    X = rng.normal(size=(8, 6))
    batch = lora_forward(W0, A, B, X, alpha=4.0)
    rows = np.stack([lora_forward(W0, A, B, x, alpha=4.0) for x in X])
    assert_close(
        batch, rows, atol=1e-9, rtol=1e-7, message="batch output must equal the row-by-row output"
    )


def test_hidden_alpha_equal_to_r_means_no_scale():
    rng = np.random.default_rng(2)
    W0 = rng.normal(size=(3, 4))
    A = rng.normal(size=(3, 4))
    B = rng.normal(size=(3, 3))
    x = rng.normal(size=4)
    assert_close(
        lora_forward(W0, A, B, x, alpha=3.0),
        lora_forward(W0, A, B, x),
        atol=1e-9,
        message="alpha = r must give scale 1",
    )


def test_hidden_scale_is_linear_in_alpha():
    rng = np.random.default_rng(3)
    W0 = rng.normal(size=(6, 5))
    A = rng.normal(size=(3, 5))
    B = rng.normal(size=(6, 3))
    x = rng.normal(size=5)
    base = W0 @ x
    d1 = lora_forward(W0, A, B, x, alpha=3.0) - base
    d2 = lora_forward(W0, A, B, x, alpha=6.0) - base
    assert_close(
        d2, 2.0 * d1, atol=1e-9, rtol=1e-7, message="doubling alpha must double the low-rank term"
    )


def test_hidden_rank_one_non_square():
    rng = np.random.default_rng(4)
    W0 = rng.normal(size=(7, 2))
    A = rng.normal(size=(1, 2))
    B = rng.normal(size=(7, 1))
    x = rng.normal(size=2)
    expected = (W0 + B @ A) @ x
    assert_close(
        lora_forward(W0, A, B, x, alpha=1.0),
        expected,
        atol=1e-9,
        rtol=1e-7,
        message="mismatch on non-square input, seed 4",
    )


def test_hidden_parameter_counts_match_formula():
    cases = [(1, 1, 1), (3, 5, 2), (768, 3072, 4), (4096, 4096, 64)]
    for d, k, r in cases:
        full = count_full_params(d, k)
        lora = count_lora_params(d, k, r)
        assert full == d * k and isinstance(full, (int, np.integer)), (
            "full parameter count mismatch on a hidden shape"
        )
        assert lora == r * (d + k) and isinstance(lora, (int, np.integer)), (
            "LoRA parameter count mismatch on a hidden shape"
        )


def test_hidden_fraction_matches_formula():
    for d, k, r in [(768, 3072, 4), (4096, 4096, 64)]:
        expected = r * (d + k) / (d * k)
        assert_close(
            trainable_fraction(d, k, r),
            expected,
            atol=1e-12,
            rtol=1e-9,
            message="trainable fraction mismatch on a hidden shape",
        )
