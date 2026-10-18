"""Visible tests. The functions of the lab come from the runner, in the same namespace.

The runner executes starter.py (or solution.py) first, then this file.
"""

# ruff: noqa: F821
import numpy as np

SCORES = np.array([2.0, 5.0, 1.0, 4.0])
VALUES = np.array([[10.0], [20.0], [30.0], [40.0]])


def test_online_softmax_example_running_state():
    # scores [2, 5, 1, 4] one at a time: m = 5, l = e^-3 + 1 + e^-4 + e^-1 = 1.4360
    m, l = online_softmax(SCORES, 1)
    assert m == 5.0, f"expected running max 5.0, got {m}"
    assert abs(l - 1.4360) < 1e-4, f"expected running sum 1.4360, got {l}"


def test_online_softmax_tile_sizes_agree():
    # any tile size must give the same max and the same sum as one direct pass
    expected = (5.0, float(np.exp(SCORES - 5.0).sum()))
    for block in (1, 2, 3, 4):
        m, l = online_softmax(SCORES, block)
        assert m == expected[0], f"block {block}: expected max {expected[0]}, got {m}"
        assert abs(l - expected[1]) < 1e-10, f"block {block}: expected sum {expected[1]}, got {l}"


def test_tiled_attention_example_value():
    # one query with d = 1: scores are exactly [2, 5, 1, 4]; output is about 24.90
    Q = np.array([[1.0]])
    K = np.array([[2.0], [5.0], [1.0], [4.0]])
    out = tiled_attention(Q, K, VALUES, 2)
    assert out.shape == (1, 1), f"expected shape (1, 1), got {out.shape}"
    assert abs(out[0, 0] - 24.90) < 0.01, f"expected output about 24.90, got {out[0, 0]}"


def test_tiled_attention_matches_naive_with_tail_tile():
    rng = np.random.default_rng(0)
    Q = rng.standard_normal((6, 4))
    K = rng.standard_normal((6, 4))
    V = rng.standard_normal((6, 3))
    expected = naive_attention(Q, K, V)
    got = tiled_attention(Q, K, V, 4)  # tiles of 4 and 2 keys
    assert got.shape == expected.shape, f"expected shape {expected.shape}, got {got.shape}"
    assert np.allclose(got, expected, rtol=1e-9, atol=1e-10), (
        "tiled output differs from naive attention on random input with seed 0"
    )
