"""Hidden tests: reference formulas, scale, offsets and norms.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import math

import numpy as np


def _reference_sinusoidal(seq_len, d, base=10000.0):
    """Entry-by-entry sinusoidal encoding in pure Python."""
    out = [[0.0] * d for _ in range(seq_len)]
    for pos in range(seq_len):
        for j in range(d):
            i = j // 2
            angle = pos / base ** (2.0 * i / d)
            out[pos][j] = math.sin(angle) if j % 2 == 0 else math.cos(angle)
    return np.array(out)


def _reference_rope(x, positions, base=10000.0):
    """Pair-by-pair rotation with explicit 2x2 matrices in pure Python."""
    x = np.asarray(x, dtype=np.float64)
    d = x.shape[1]
    out = np.zeros_like(x)
    for t, pos in enumerate(positions):
        for i in range(d // 2):
            theta = base ** (-2.0 * i / d)
            c, s = math.cos(pos * theta), math.sin(pos * theta)
            a, b = x[t, 2 * i], x[t, 2 * i + 1]
            out[t, 2 * i] = c * a - s * b
            out[t, 2 * i + 1] = s * a + c * b
    return out


def test_hidden_sinusoidal_matches_reference():
    assert_close(
        sinusoidal_encoding(9, 10),
        _reference_sinusoidal(9, 10),
        atol=1e-9,
        message="sinusoidal encoding differs from the formula, shape (9, 10)",
    )


def test_hidden_sinusoidal_bounded_and_finite():
    pe = sinusoidal_encoding(200, 64)
    assert np.all(np.isfinite(pe)), "non-finite values in encoding"
    assert np.all(np.abs(pe) <= 1.0 + 1e-12), "sin and cos must stay within [-1, 1]"


def test_hidden_d2_single_frequency():
    rng = np.random.default_rng(5)
    x = rng.normal(size=(4, 2))
    positions = [0, 2, 5, 9]
    expected = np.array(
        [
            [x[t, 0] * np.cos(p) - x[t, 1] * np.sin(p), x[t, 0] * np.sin(p) + x[t, 1] * np.cos(p)]
            for t, p in enumerate(positions)
        ]
    )
    assert_close(
        apply_rope(x, positions=positions),
        expected,
        atol=1e-9,
        message="d = 2 rotation mismatch on random input, seed 5",
    )


def test_hidden_explicit_positions_match_reference():
    rng = np.random.default_rng(0)
    x = rng.normal(size=(4, 8))
    positions = [0, 3, 7, 20]
    assert_close(
        apply_rope(x, positions=positions),
        _reference_rope(x, positions),
        atol=1e-9,
        message="explicit positions mismatch on random input, seed 0",
    )


def test_hidden_rope_preserves_row_norms():
    rng = np.random.default_rng(1)
    x = rng.normal(size=(7, 12))
    positions = rng.integers(0, 500, size=7)
    out = apply_rope(x, positions=positions)
    assert_close(
        np.linalg.norm(out, axis=1),
        np.linalg.norm(x, axis=1),
        atol=1e-9,
        message="rotation must preserve the norm of each row",
    )


def test_hidden_relative_invariance_large_offset():
    rng = np.random.default_rng(2)
    for d in (2, 8, 16):
        q = rng.normal(size=d)
        k = rng.normal(size=d)
        length = 10
        base_scores = apply_rope(np.tile(q, (length, 1))) @ apply_rope(np.tile(k, (length, 1))).T
        shifted_q = apply_rope(np.tile(q, (length, 1)), positions=np.arange(length) + 1000)
        shifted_k = apply_rope(np.tile(k, (length, 1)), positions=np.arange(length) + 1000)
        assert_close(
            shifted_q @ shifted_k.T,
            base_scores,
            atol=1e-6,
            message=f"scores must not change under a common shift, d={d}",
        )


def test_hidden_inputs_not_mutated():
    rng = np.random.default_rng(3)
    x = rng.normal(size=(3, 6))
    x_copy = x.copy()
    apply_rope(x)
    assert np.array_equal(x, x_copy), "input must not be modified"
