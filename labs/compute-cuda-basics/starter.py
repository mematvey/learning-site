"""CUDA indexing simulator: starter code.

A kernel launch is simulated on the CPU. Each function below plays the role of
one line of a CUDA kernel or of the host code. Complete the `# TODO` parts so
that they match the chapter text "Основы CUDA".
"""

import numpy as np


def grid_dim(n, block_dim):
    """Number of blocks G for N elements and B threads per block.

    Use the smallest G with G * B >= N, computed with integer arithmetic.
    """
    # TODO: ceil(N / B) without floats, e.g. (N + B - 1) // B
    return n // block_dim


def global_index(block_idx, block_dim, thread_idx):
    """Global index of a thread: blockIdx * blockDim + threadIdx."""
    # TODO: add the block offset blockIdx * blockDim
    return thread_idx


def in_bounds(index, n):
    """Bounds check of a kernel: True when the thread works on element `index`."""
    # TODO: the thread works only when index < N
    return True


def idle_threads(n, block_dim):
    """Launched threads that have no element: G * B - N."""
    # TODO: count the threads with global index >= N
    return 0


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
