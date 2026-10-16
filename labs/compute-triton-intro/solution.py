"""Triton intro: block-wise vector addition with a tail mask, simulated in NumPy.

Reference solution. Names and arguments match the chapter text.
"""

import numpy as np


def cdiv(a, b):
    """Ceil division of positive integers, the same as triton.cdiv(a, b)."""
    return (a + b - 1) // b


def num_programs(n, block):
    """Number of programs in the grid: ceil(n / block)."""
    return cdiv(n, block)


def program_offsets(pid, block):
    """Positions of program `pid`: pid * block + t for t = 0..block-1."""
    return pid * block + np.arange(block)


def program_mask(offsets, n):
    """True where the position lies inside the vector of length n."""
    return np.asarray(offsets) < n


def add_kernel(x, y, block):
    """Simulate out = x + y over blocks. Masked lanes are never stored; their loads read index 0 as a stand-in.

    Each program loads with a mask: masked lanes read index 0 as a stand-in, so no
    access goes out of bounds. Then it adds and stores only the lanes the mask allows.
    """
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    n = x.shape[0]
    out = np.zeros(n, dtype=np.float64)
    for pid in range(num_programs(n, block)):
        offsets = program_offsets(pid, block)
        mask = program_mask(offsets, n)
        # tl.load(x_ptr + offsets, mask=mask, other=0), same for y
        safe = np.where(mask, offsets, 0)
        total = x[safe] + y[safe]
        # tl.store(out_ptr + offsets, total, mask=mask)
        out[offsets[mask]] = total[mask]
    return out
