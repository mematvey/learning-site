"""Sinusoidal positional encoding and RoPE: reference solution."""

import numpy as np


def sinusoidal_encoding(seq_len, d, base=10000.0):
    """Sinusoidal encoding matrix of shape (seq_len, d).

    Row `pos` is PE(pos): PE[pos, 2i] = sin(pos / base**(2i/d)) and
    PE[pos, 2i+1] = cos(pos / base**(2i/d)). `d` must be even.
    """
    if d % 2 != 0:
        raise ValueError(f"d must be even, got {d}")
    pos = np.arange(seq_len, dtype=np.float64)[:, None]
    i = np.arange(d // 2, dtype=np.float64)[None, :]
    # One angle per (position, pair): shape (seq_len, d // 2).
    angle = pos / base ** (2 * i / d)
    pe = np.zeros((seq_len, d), dtype=np.float64)
    pe[:, 0::2] = np.sin(angle)
    pe[:, 1::2] = np.cos(angle)
    return pe


def apply_rope(x, positions=None, base=10000.0):
    """Rotate each pair of components of every row of `x` by its position.

    x: array of shape (seq_len, d), d even. Row t is rotated by the angle
    positions[t] * theta_i in pair i, where theta_i = base**(-2i/d).
    If `positions` is None, the rows get positions 0, 1, ..., seq_len-1.
    Values are not rotated: call this on queries and keys only.
    """
    x = np.asarray(x, dtype=np.float64)
    seq_len, d = x.shape
    if d % 2 != 0:
        raise ValueError(f"d must be even, got {d}")
    if positions is None:
        positions = np.arange(seq_len)
    pos = np.asarray(positions, dtype=np.float64)
    theta = base ** (-2.0 * np.arange(d // 2) / d)
    angle = pos[:, None] * theta[None, :]
    cos, sin = np.cos(angle), np.sin(angle)
    x_even = x[:, 0::2]
    x_odd = x[:, 1::2]
    # Rotation matrix [[cos, -sin], [sin, cos]] applied to each pair (x_even, x_odd).
    out = np.empty_like(x)
    out[:, 0::2] = x_even * cos - x_odd * sin
    out[:, 1::2] = x_even * sin + x_odd * cos
    return out
