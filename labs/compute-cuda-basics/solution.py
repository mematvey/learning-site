"""CUDA indexing simulator: reference solution.

A CUDA launch is simulated on the CPU: every (blockIdx, threadIdx) pair is
visited and the global index and the bounds check are computed as a device
thread would compute them.
"""

import numpy as np


def grid_dim(n, block_dim):
    """Number of blocks G = ceil(N / B), using integer arithmetic only."""
    return (n + block_dim - 1) // block_dim


def global_index(block_idx, block_dim, thread_idx):
    """Global index of a thread: i = blockIdx * blockDim + threadIdx."""
    return block_idx * block_dim + thread_idx


def in_bounds(index, n):
    """Bounds check of a kernel: True when the thread works on element `index`."""
    return index < n


def idle_threads(n, block_dim):
    """Launched threads that have no element: G * B - N."""
    return grid_dim(n, block_dim) * block_dim - n


def simulate_launch(n, block_dim):
    """Simulates a launch of N elements with B threads per block.

    Returns (indices, active): two arrays of shape (G, B). indices[b, t] is the
    global index of thread t in block b; active[b, t] is True when that thread
    passes the bounds check.
    """
    blocks = grid_dim(n, block_dim)
    indices = np.zeros((blocks, block_dim), dtype=np.int64)
    active = np.zeros((blocks, block_dim), dtype=bool)
    for b in range(blocks):
        for t in range(block_dim):
            i = global_index(b, block_dim, t)
            indices[b, t] = i
            active[b, t] = in_bounds(i, n)
    return indices, active
