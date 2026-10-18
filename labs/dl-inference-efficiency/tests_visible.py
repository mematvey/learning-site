"""Visible tests. `attention_step`, `decode_no_cache`, `decode_with_cache` and `assert_close`
come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def test_output_shapes():
    rng = np.random.default_rng(1)
    X = rng.normal(size=(5, 4))
    Wq = rng.normal(size=(4, 3))
    Wk = rng.normal(size=(4, 3))
    Wv = rng.normal(size=(4, 2))
    out = decode_with_cache(X, Wq, Wk, Wv)
    assert out.shape == (5, 2), f"expected output shape (5, 2), got {out.shape}"
    out_ref = decode_no_cache(X, Wq, Wk, Wv)
    assert out_ref.shape == (5, 2), f"expected output shape (5, 2), got {out_ref.shape}"


def test_small_hand_case():
    # Identity projections, d_k = 2. Step 0 sees only itself: output [1, 0].
    # Step 1 scores the keys [1, 0] and [0, 1] with q = [0, 1] / sqrt(2),
    # so the weights are [0.330238, 0.669762].
    I = np.eye(2)
    X = np.array([[1.0, 0.0], [0.0, 1.0]])
    expected = np.array([[1.0, 0.0], [0.330238, 0.669762]])
    out = decode_with_cache(X, I, I, I)
    assert_close(out, expected, atol=1e-5, rtol=1e-5, message="cached decoding, identity case")
    out_ref = decode_no_cache(X, I, I, I)
    assert_close(out_ref, expected, atol=1e-5, rtol=1e-5, message="decoding without cache")


def test_attention_step_single_key():
    # With one key the weight is 1, so the output is that value vector.
    q = np.array([0.5, -0.2, 1.0])
    K = np.array([[1.0, 2.0, 3.0]])
    V = np.array([[7.0, -1.0]])
    out = attention_step(q, K, V)
    assert out.shape == (2,), f"expected shape (2,), got {out.shape}"
    assert_close(out, [7.0, -1.0], atol=1e-9, rtol=1e-9, message="single key must return its value")


def test_cache_matches_recompute_seed_0():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(6, 4))
    Wq = rng.normal(size=(4, 4))
    Wk = rng.normal(size=(4, 4))
    Wv = rng.normal(size=(4, 4))
    cached = decode_with_cache(X, Wq, Wk, Wv)
    full = decode_no_cache(X, Wq, Wk, Wv)
    assert_close(
        cached,
        full,
        atol=1e-9,
        rtol=1e-9,
        message="cached decoding must match recomputing the whole prefix",
    )
