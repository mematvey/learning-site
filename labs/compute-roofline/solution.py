"""Roofline calculator: reference solution.

The roofline model gives the attainable performance of a kernel:
P_attainable = min(P, I * B), where P is the peak performance (FLOP/s),
B is the memory bandwidth (byte/s) and I is the arithmetic intensity (FLOP/byte).
The ridge point I* = P / B is where the two limits meet.
"""

import numpy as np


def _check_positive(name, value):
    if not value > 0:
        raise ValueError(f"{name} must be positive, got {value}")


def arithmetic_intensity(flops, bytes_moved):
    """Arithmetic intensity I = W / Q in FLOP per byte."""
    if flops < 0:
        raise ValueError(f"flops must not be negative, got {flops}")
    _check_positive("bytes_moved", bytes_moved)
    return flops / bytes_moved


def ridge_point(peak_flops, bandwidth):
    """Ridge point I* = P / B in FLOP per byte."""
    _check_positive("peak_flops", peak_flops)
    _check_positive("bandwidth", bandwidth)
    return peak_flops / bandwidth


def attainable_performance(peak_flops, bandwidth, intensity):
    """Attainable performance min(P, I * B) in FLOP per second."""
    _check_positive("peak_flops", peak_flops)
    _check_positive("bandwidth", bandwidth)
    if intensity < 0:
        raise ValueError(f"intensity must not be negative, got {intensity}")
    return min(peak_flops, intensity * bandwidth)


def roofline_curve(peak_flops, bandwidth, intensities):
    """Attainable performance for an array of intensities, as a NumPy array."""
    _check_positive("peak_flops", peak_flops)
    _check_positive("bandwidth", bandwidth)
    intensities = np.asarray(intensities, dtype=np.float64)
    if np.any(intensities < 0):
        raise ValueError("intensities must not be negative")
    return np.minimum(peak_flops, intensities * bandwidth)


def limiting_factor(peak_flops, bandwidth, intensity):
    """Returns "memory" when I < I* and "compute" otherwise."""
    if intensity < 0:
        raise ValueError(f"intensity must not be negative, got {intensity}")
    if intensity < ridge_point(peak_flops, bandwidth):
        return "memory"
    return "compute"
