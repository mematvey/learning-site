"""Hidden tests: edge cases and other launch shapes.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def _ceil_div(n, b):
    return -(-n // b)


def test_hidden_grid_dim_matches_ceil_on_many_pairs():
    for n in range(1, 130):
        for b in (1, 2, 3, 32, 64, 256):
            g = grid_dim(n, b)
            assert g == _ceil_div(n, b), f"grid_dim({n}, {b}) = {g}, expected {_ceil_div(n, b)}"
            assert g * b >= n, f"grid_dim({n}, {b}) = {g} does not cover all elements"
            assert (g - 1) * b < n, f"grid_dim({n}, {b}) = {g} launches a block too many"


def test_hidden_exact_multiple_has_no_idle_threads():
    assert grid_dim(512, 256) == 2, "N divisible by B: exactly N / B blocks"
    assert idle_threads(512, 256) == 0, "no idle threads when N is a multiple of B"


def test_hidden_fewer_elements_than_block():
    assert grid_dim(5, 32) == 1, "one block is enough when N < B"
    assert idle_threads(5, 32) == 27, "32 - 5 threads of the single block are idle"


def test_hidden_block_of_one_thread():
    assert grid_dim(7, 1) == 7, "with B = 1 every element gets a block"
    assert idle_threads(7, 1) == 0, "with B = 1 nothing is idle"


def test_hidden_large_launch_sizes():
    n = 1_000_003
    b = 1024
    assert grid_dim(n, b) == 977, f"expected 977 blocks, got {grid_dim(n, b)}"
    assert idle_threads(n, b) == 977 * 1024 - n, "idle count must be G * B - N"


def test_hidden_global_index_is_a_bijection():
    b_dim = 64
    seen = [global_index(b, b_dim, t) for b in range(5) for t in range(b_dim)]
    assert seen == list(range(5 * b_dim)), "global indices must be 0, 1, 2, ... in launch order"


def test_hidden_simulate_launch_matches_formula():
    for n, b in ((1, 32), (100, 32), (1000, 256), (513, 512), (3, 1)):
        indices, active = simulate_launch(n, b)
        g = _ceil_div(n, b)
        assert indices.shape == (g, b), f"shape for N={n}, B={b} must be {(g, b)}"
        assert np.array_equal(indices, np.arange(g * b).reshape(g, b)), (
            f"indices wrong for N={n}, B={b}"
        )
        assert int(active.sum()) == n, f"active threads for N={n}, B={b} must equal N"
        assert np.array_equal(active.reshape(-1), np.arange(g * b) < n), (
            f"bounds check mask wrong for N={n}, B={b}"
        )


def test_hidden_simulate_launch_mask_is_a_prefix():
    _, active = simulate_launch(1000, 128)
    flat = active.reshape(-1)
    first_idle = int(np.argmin(flat)) if not flat.all() else flat.size
    assert not flat[first_idle:].any(), "active threads must form a prefix of the launch"
    assert flat[:first_idle].all(), "threads before the first idle one must be active"
