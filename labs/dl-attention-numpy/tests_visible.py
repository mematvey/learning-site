"""Visible tests. `attention`, `report_array` and `assert_close` are provided by the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def test_output_shapes():
    Q = np.zeros((4, 8))
    K = np.zeros((6, 8))
    V = np.zeros((6, 5))
    out, weights = attention(Q, K, V)
    assert out.shape == (4, 5), f"expected output shape (4, 5), got {out.shape}"
    assert weights.shape == (4, 6), f"expected weights shape (4, 6), got {weights.shape}"


def test_small_hand_case():
    # One query, two keys, d = 2: scores are [1/sqrt(2), 0] after scaling.
    Q = np.array([[1.0, 0.0]])
    K = np.array([[1.0, 0.0], [0.0, 1.0]])
    V = np.array([[1.0, 2.0], [3.0, 4.0]])
    out, weights = attention(Q, K, V)
    expected_w = np.array([[0.669782, 0.330218]])
    expected_out = np.array([[1.660436, 2.660436]])
    assert_close(weights, expected_w, atol=1e-4, rtol=1e-4, message="attention weights")
    assert_close(out, expected_out, atol=1e-4, rtol=1e-4, message="attention output")


def test_weights_rows_sum_to_one_visible():
    rng = np.random.default_rng(0)
    Q = rng.normal(size=(3, 4))
    K = rng.normal(size=(5, 4))
    V = rng.normal(size=(5, 2))
    _, weights = attention(Q, K, V)
    assert_close(weights.sum(axis=-1), np.ones(3), atol=1e-6, message="row sums must be 1")


def test_causal_mask_blocks_future():
    # Causal mask: query i may attend only to keys j <= i.
    rng = np.random.default_rng(5)
    Q = rng.normal(size=(3, 2))
    K = rng.normal(size=(3, 2))
    V = rng.normal(size=(3, 2))
    mask = np.tril(np.ones((3, 3), dtype=bool))
    _, weights = attention(Q, K, V, mask=mask)
    assert np.all(weights[~mask] == 0.0), (
        f"future positions must get zero weight, got {weights.tolist()}"
    )
    assert_close(weights[0], [1.0, 0.0, 0.0], atol=1e-9, message="first query sees only key 0")
    assert_close(weights.sum(axis=-1), np.ones(3), atol=1e-6, message="row sums must be 1")


def test_report_weights_for_heatmap():
    # Passes the weight matrix to the heatmap visualizer for a small random case.
    rng = np.random.default_rng(0)
    Q = rng.normal(size=(4, 8))
    K = rng.normal(size=(4, 8))
    V = rng.normal(size=(4, 8))
    _, weights = attention(Q, K, V)
    report_array("weights", weights)
    assert weights.shape == (4, 4), f"expected weights shape (4, 4), got {weights.shape}"
