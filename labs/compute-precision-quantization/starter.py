"""Number formats and integer quantization: starter code.

Three things are simulated on the CPU: rounding to fp16 and bf16, the maximum
value of a format, and symmetric int quantization with one scale per group.
Complete the `# TODO` parts so that they match the chapter text
"Форматы чисел и квантизация".

Conventions:
- Values are float64 arrays; rounding results are returned as float64.
- Integer quantization is symmetric: q lies in [-(2**(bits-1) - 1), 2**(bits-1) - 1].
- The scale of a group is s = max(|x|) / qmax; a group that is all zeros uses s = 1.0.
- Relative error is ||x - x_hat||_2 / ||x||_2.
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

    The default seed is the vector of the chapter demo. This function is complete;
    use it as the input vector for the experiments.
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
    """Round every value to the nearest float16 (ties to even) and return float64.

    Values above the fp16 maximum become inf.
    """
    # TODO: cast to np.float16 and back to np.float64; mind the overflow
    raise NotImplementedError


def to_bf16(x):
    """Round every value to the nearest bfloat16 (ties to even) and return float64.

    bfloat16 keeps the sign bit and the 8 exponent bits of float32, and only the
    top 7 mantissa bits. Work on the float32 bit pattern (view as uint32).
    """
    # TODO: add the rounding bias (0x7FFF plus the lowest kept bit), then clear the low 16 bits
    raise NotImplementedError


def format_max(fmt):
    """Largest finite value of a format: 'fp16', 'bf16', 'e4m3' or 'e5m2'.

    Raise ValueError for any other name.
    """
    # TODO: return the maximum for each format; see the chapter, section "Математика"
    raise NotImplementedError


def quantize_int(x, bits, group_size=None):
    """Symmetric integer quantization of a 1D vector, one scale per group.

    The vector is split into consecutive groups of `group_size` values. If
    group_size is None, the whole vector is one group. Returns (q, scales):
    q is an int64 array of the same length as x, scales has one float per group.
    """
    # TODO: scale = max|x| / qmax per group, q = round(x / scale) clipped to [-qmax, qmax]
    raise NotImplementedError


def dequantize_int(q, scales):
    """Reconstruct x_hat = scale * q, group by group. Returns a 1D float64 array.

    The group size is taken from the shapes: len(q) // len(scales).
    """
    # TODO: multiply each group of q by its scale
    raise NotImplementedError


def relative_error(x, x_hat):
    """Relative L2 error: ||x - x_hat|| / ||x||, as a float."""
    # TODO: norm of the difference divided by the norm of x
    raise NotImplementedError
