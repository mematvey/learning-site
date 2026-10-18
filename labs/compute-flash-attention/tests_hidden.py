"""Hidden tests: edge cases and numerical stability.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def _direct_max_sum(x):
    m = x.max()
    return m, np.exp(x - m).sum()


def test_hidden_online_softmax_max_arrives_last():
    # a naive online version without rescaling fails when the maximum is at the end
    x = np.array([0.0, 1.0, 2.0, 30.0])
    m, l = online_softmax(x, 1)
    em, el = _direct_max_sum(x)
    assert m == em, "running max must follow the maximum that arrives later"
    assert abs(l - el) < 1e-10 * el, "running sum must be rescaled when the max changes"


def test_hidden_online_softmax_random_rows_all_tile_sizes():
    rng = np.random.default_rng(0)
    for n in (1, 2, 5, 17, 64):
        x = rng.standard_normal(n) * 3.0
        em, el = _direct_max_sum(x)
        for block in (1, 2, 3, 7, n, n + 5):
            m, l = online_softmax(x, block)
            assert m == em, f"n={n}, block={block}: wrong running max"
            assert abs(l - el) <= 1e-9 * el, f"n={n}, block={block}: wrong running sum"


def test_hidden_online_softmax_large_scores_no_overflow():
    # scores around 1000 overflow exp() without subtracting the running maximum
    x = np.array([1000.0, 1001.0, 999.5, 1000.25])
    m, l = online_softmax(x, 2)
    em, el = _direct_max_sum(x)
    assert np.isfinite(l), "running sum must stay finite for large scores"
    assert m == em, "running max is wrong for large scores"
    assert abs(l - el) <= 1e-9 * el, "running sum is wrong for large scores"


def test_hidden_tiled_attention_random_shapes():
    rng = np.random.default_rng(0)
    for n, d, dv in ((1, 1, 1), (3, 1, 2), (8, 5, 4), (13, 16, 7)):
        Q = rng.standard_normal((n, d))
        K = rng.standard_normal((n, d))
        V = rng.standard_normal((n, dv))
        expected = naive_attention(Q, K, V)
        for block in (1, 3, n, n + 4):
            got = tiled_attention(Q, K, V, block)
            assert got.shape == expected.shape, (
                f"n={n}, d={d}, dv={dv}, block={block}: shape {got.shape}"
            )
            assert np.allclose(got, expected, rtol=1e-9, atol=1e-10), (
                f"n={n}, d={d}, dv={dv}, block={block}: mismatch on random input, seed 0"
            )


def test_hidden_tiled_attention_large_logits():
    # large query and key norms give scores in the hundreds: the rescaling must keep it stable
    rng = np.random.default_rng(0)
    Q = rng.standard_normal((5, 8)) * 20.0
    K = rng.standard_normal((5, 8)) * 20.0
    V = rng.standard_normal((5, 3))
    expected = naive_attention(Q, K, V)
    got = tiled_attention(Q, K, V, 2)
    assert np.all(np.isfinite(got)), "output must be finite for large logits"
    assert np.allclose(got, expected, rtol=1e-7, atol=1e-8), "mismatch for large logits, seed 0"


def test_hidden_zero_queries_average_values():
    # with Q = 0 every score is 0, so each output row is the mean of V
    rng = np.random.default_rng(0)
    Q = np.zeros((4, 3))
    K = rng.standard_normal((4, 3))
    V = rng.standard_normal((4, 2))
    got = tiled_attention(Q, K, V, 3)
    expected = np.tile(V.mean(axis=0), (4, 1))
    assert np.allclose(got, expected, rtol=1e-9, atol=1e-10), "zero queries must average the values"
