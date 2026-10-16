"""Triton intro: block-wise vector addition with a tail mask, simulated in NumPy.

A Triton program handles one block of `block` consecutive positions. The grid has
ceil(n / block) programs. The last block may be incomplete, so its lanes past the
end of the vector are masked: they are not loaded and not stored.

Complete the five functions so that they match the chapter text. The names follow
the chapter: `cdiv` mirrors triton.cdiv, `program_offsets` is `pid * BLOCK_SIZE + tl.arange`.
Numpy is needed for the offsets and masks: add `import numpy as np` at the top.
"""


def cdiv(a, b):
    """Ceil division of positive integers, the same as triton.cdiv(a, b)."""
    # TODO: round a / b up with integer arithmetic (not float division)
    raise NotImplementedError


def num_programs(n, block):
    """Number of programs in the grid for a vector of length `n` and block size `block`."""
    # TODO: use cdiv; floor division would drop the incomplete last block
    raise NotImplementedError


def program_offsets(pid, block):
    """Positions of program `pid`: pid * block + t for t = 0..block-1, as an int array."""
    # TODO: build the offsets with np.arange
    raise NotImplementedError


def program_mask(offsets, n):
    """Boolean array: True where the position lies inside the vector of length n."""
    # TODO: compare the offsets with n
    raise NotImplementedError


def add_kernel(x, y, block):
    """Simulate out = x + y over blocks. Masked lanes are not loaded and not stored.

    Returns a float array of length n.
    """
    # TODO: loop over the programs; apply the mask to the loads and to the store
    raise NotImplementedError
