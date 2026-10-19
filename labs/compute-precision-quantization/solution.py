"""Number formats and integer quantization: reference solution.

Rounding to fp16 and bf16, maximum values of formats, and symmetric int
quantization with one scale per group. Conventions are described in starter.py.
"""

import math

import numpy as np

_MASK32 = 0xFFFFFFFF


def _mulberry32(seed):
    """Seeded 32-bit generator (mulberry32). The same seed gives the same sequence."""
    state = seed & _MASK32

    def next_uniform():
        nonlocal state
        state = (state + 0x6D2B79F5) & _MASK32
        t = state
        t = ((t ^ (t >> 15)) * (t | 1)) & _MASK32
        t = (t ^ ((t + (((t ^ (t >> 7)) * (t | 61)) & _MASK32)) & _MASK32)) & _MASK32
        return ((t ^ (t >> 14)) & _MASK32) / 4294967296.0

    return next_uniform


def make_outlier_vector(n=4096, seed=20260):
    """Test data: standard normal values (Box-Muller), and every 256th value times 20.

    The default seed is the vector of the chapter demo.
    """
    rnd = _mulberry32(seed)
    x = np.empty(n)
    for i in range(n):
        u1 = max(rnd(), 1e-12)
        u2 = rnd()
        z = math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)
        x[i] = z * 20.0 if i % 256 == 0 else z
    return x


def to_fp16(x):
    """Round every value to the nearest float16 (ties to even) and return float64."""
    x = np.asarray(x, dtype=np.float64)
    with np.errstate(over="ignore"):
        return x.astype(np.float16).astype(np.float64)


def to_bf16(x):
    """Round every value to the nearest bfloat16 (ties to even) and return float64.

    The float32 bit pattern is rounded at bit 16. Adding 0x7FFF plus the lowest
    kept bit gives round-half-to-even; then the low 16 bits are cleared.
    """
    x32 = np.asarray(x, dtype=np.float32)
    bits = x32.view(np.uint32).astype(np.uint64)
    lsb = (bits >> 16) & 1
    rounded = (bits + 0x7FFF + lsb) & 0xFFFF0000
    return rounded.astype(np.uint32).view(np.float32).astype(np.float64)


_FORMAT_MAX = {
    "fp16": (2 - 2**-10) * 2.0**15,  # 10 mantissa bits, bias 15, top exponent 30
    "bf16": (2 - 2**-7) * 2.0**127,  # 7 mantissa bits, bias 127, same range as fp32
    "e4m3": (2 - 2**-2) * 2.0**8,  # 3 mantissa bits, top exponent 8 (NaN, no inf)
    "e5m2": (2 - 2**-2) * 2.0**15,  # 2 mantissa bits, top exponent 15
}


def format_max(fmt):
    """Largest finite value of a format: 'fp16', 'bf16', 'e4m3' or 'e5m2'."""
    if fmt not in _FORMAT_MAX:
        raise ValueError(f"unknown format {fmt!r}")
    return _FORMAT_MAX[fmt]


def quantize_int(x, bits, group_size=None):
    """Symmetric integer quantization of a 1D vector, one scale per group.

    Returns (q, scales). A group of zeros gets scale 1.0, so its codes are 0.
    """
    x = np.asarray(x, dtype=np.float64).reshape(-1)
    n = x.size
    size = n if group_size is None else group_size
    if size <= 0 or n % size != 0:
        raise ValueError(f"length {n} is not divisible by group size {size}")
    qmax = 2 ** (bits - 1) - 1
    groups = x.reshape(-1, size)
    max_abs = np.abs(groups).max(axis=1, keepdims=True)
    scales = np.where(max_abs > 0, max_abs / qmax, 1.0)
    q = np.clip(np.round(groups / scales), -qmax, qmax).astype(np.int64)
    return q.reshape(-1), scales.reshape(-1)


def dequantize_int(q, scales):
    """Reconstruct x_hat = scale * q, group by group."""
    q = np.asarray(q, dtype=np.float64).reshape(-1)
    scales = np.asarray(scales, dtype=np.float64).reshape(-1)
    size = q.size // scales.size
    return (q.reshape(-1, size) * scales[:, None]).reshape(-1)


def relative_error(x, x_hat):
    """Relative L2 error: ||x - x_hat|| / ||x||."""
    x = np.asarray(x, dtype=np.float64)
    x_hat = np.asarray(x_hat, dtype=np.float64)
    return float(np.linalg.norm(x - x_hat) / np.linalg.norm(x))
