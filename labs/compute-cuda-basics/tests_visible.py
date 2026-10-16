"""Visible tests. The functions of the lab come from the runner, in the same namespace.

The runner executes starter.py (or solution.py) first, then this file.
"""

# ruff: noqa: F821
import numpy as np


def test_grid_dim_example_1000_by_256():
    # 1000 elements, 256 threads per block: ceil(1000 / 256) = 4 blocks, not 3
    g = grid_dim(1000, 256)
    assert g == 4, f"expected 4 blocks for N=1000, B=256, got {g}"


def test_global_index_formula():
    # block 2, thread 5 of a block of 256 threads: 2 * 256 + 5 = 517
    i = global_index(2, 256, 5)
    assert i == 517, f"expected global index 517 for blockIdx=2, threadIdx=5, got {i}"


def test_idle_threads_example():
    # 4 blocks of 256 = 1024 threads, 1000 elements: 24 threads have nothing to do
    idle = idle_threads(1000, 256)
    assert idle == 24, f"expected 24 idle threads, got {idle}"


def test_bounds_check_example():
    assert in_bounds(999, 1000) is True, "index 999 is inside an array of 1000 elements"
    assert in_bounds(1000, 1000) is False, "index 1000 is outside an array of 1000 elements"


def test_simulate_launch_shape_and_indices():
    indices, _ = simulate_launch(1000, 256)
    assert indices.shape == (4, 256), f"expected shape (4, 256), got {indices.shape}"
    expected = np.arange(1024).reshape(4, 256)
    assert np.array_equal(indices, expected), "thread (b, t) must have global index b*256 + t"


def test_simulate_launch_marks_idle_threads():
    _, active = simulate_launch(1000, 256)
    assert active.sum() == 1000, f"expected 1000 active threads, got {int(active.sum())}"
    assert not active[3, 232:].any(), "threads 1000..1023 (block 3, t >= 232) must be idle"
    assert active.reshape(-1)[:1000].all(), "threads 0..999 must all be active"
