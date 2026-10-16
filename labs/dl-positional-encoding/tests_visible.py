"""Visible tests. `sinusoidal_encoding`, `apply_rope` and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def test_sinusoidal_shape():
    pe = sinusoidal_encoding(5, 8)
    assert pe.shape == (5, 8), f"expected shape (5, 8), got {pe.shape}"


def test_sinusoidal_position_zero_row():
    # PE(0): sin(0) = 0 and cos(0) = 1 in every pair.
    pe = sinusoidal_encoding(4, 6)
    expected = [0.0, 1.0, 0.0, 1.0, 0.0, 1.0]
    assert_close(pe[0], expected, atol=1e-9, message=f"expected {expected}, got {pe[0].tolist()}")


def test_sinusoidal_hand_case():
    # d = 2 has a single pair with frequency 1: PE(pos) = (sin pos, cos pos).
    pe = sinusoidal_encoding(3, 2)
    expected = [[0.0, 1.0], [np.sin(1.0), np.cos(1.0)], [np.sin(2.0), np.cos(2.0)]]
    assert_close(pe, expected, atol=1e-9, message=f"expected {expected}, got {pe.tolist()}")


def test_rope_position_zero_is_identity():
    x = np.arange(12, dtype=float).reshape(3, 4) - 5.0
    out = apply_rope(x, positions=[0, 0, 0])
    assert_close(out, x, atol=1e-9, message="rotation by angle 0 must leave x unchanged")


def test_rope_hand_case():
    # d = 2, theta = 1: row at position 1 rotates (1, 0) into (cos 1, sin 1).
    x = np.array([[1.0, 0.0], [1.0, 0.0]])
    out = apply_rope(x, positions=[0, 1])
    expected = [[1.0, 0.0], [np.cos(1.0), np.sin(1.0)]]
    assert_close(out, expected, atol=1e-9, message=f"expected {expected}, got {out.tolist()}")


def test_rope_score_depends_on_offset():
    # Same q and k in every row: the score S[m, n] must depend only on n - m.
    rng = np.random.default_rng(0)
    q = rng.normal(size=4)
    k = rng.normal(size=4)
    length = 6
    qr = apply_rope(np.tile(q, (length, 1)))
    kr = apply_rope(np.tile(k, (length, 1)))
    scores = qr @ kr.T
    assert_close(
        scores[1, 3],
        scores[2, 4],
        atol=1e-9,
        message="score for (1, 3) must equal score for (2, 4)",
    )
    assert_close(
        scores[0, 2],
        scores[3, 5],
        atol=1e-9,
        message="score for (0, 2) must equal score for (3, 5)",
    )
