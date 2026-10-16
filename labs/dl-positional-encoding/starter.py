"""Sinusoidal positional encoding and RoPE: starter code.

Complete `sinusoidal_encoding` and `apply_rope` so that they match the chapter
text (section "Математика"). Components come in pairs (2i, 2i+1) that share
the frequency theta_i = base**(-2i/d).
"""

import numpy as np


def sinusoidal_encoding(seq_len, d, base=10000.0):
    """Sinusoidal encoding matrix of shape (seq_len, d).

    Row `pos` is PE(pos): PE[pos, 2i] = sin(pos / base**(2i/d)) and
    PE[pos, 2i+1] = cos(pos / base**(2i/d)). `d` must be even.
    """
    # TODO: build a (seq_len, d) array; fill even columns with sin and odd with cos
    raise NotImplementedError


def apply_rope(x, positions=None, base=10000.0):
    """Rotate each pair of components of every row of `x` by its position.

    x: array of shape (seq_len, d), d even. Row t is rotated by the angle
    positions[t] * theta_i in pair i, where theta_i = base**(-2i/d).
    If `positions` is None, the rows get positions 0, 1, ..., seq_len-1.
    Values are not rotated: call this on queries and keys only.
    """
    x = np.asarray(x, dtype=np.float64)
    # TODO: rotate each pair (x[t, 2i], x[t, 2i+1]) by its angle, using the
    # 2x2 rotation matrix from the chapter; keep the input array unchanged
    raise NotImplementedError
