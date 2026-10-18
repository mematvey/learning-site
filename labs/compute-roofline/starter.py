"""Roofline calculator: starter code.

Units used everywhere in this lab:
- peak_flops: peak performance of the unit, FLOP per second (67 TFLOPS = 67e12);
- bandwidth: memory bandwidth, bytes per second (3.35 TB/s = 3.35e12);
- intensity: arithmetic intensity, FLOP per byte;
- flops and bytes_moved: counts for one kernel launch.

Complete the `# TODO` parts so that they match the chapter text "Roofline".
"""


def arithmetic_intensity(flops, bytes_moved):
    """Arithmetic intensity I = W / Q in FLOP per byte.

    `flops` is the number of floating-point operations W, `bytes_moved` is the
    number of bytes Q that the kernel moves between memory and compute units.
    """
    # TODO: divide the work by the traffic; raise ValueError if bytes_moved <= 0
    raise NotImplementedError


def ridge_point(peak_flops, bandwidth):
    """Ridge point I* = P / B in FLOP per byte: where the two limits meet."""
    # TODO: peak performance divided by memory bandwidth
    raise NotImplementedError


def attainable_performance(peak_flops, bandwidth, intensity):
    """Attainable performance min(P, I * B) in FLOP per second for one intensity."""
    # TODO: the smaller of the two limits: the flat roof P and the slope I * B
    raise NotImplementedError


def roofline_curve(peak_flops, bandwidth, intensities):
    """Attainable performance for an array of intensities, as a NumPy array.

    The result has the same shape as `intensities`. Use vectorized operations.
    """
    # TODO: element-wise minimum of the roof and the slope, with NumPy
    raise NotImplementedError


def limiting_factor(peak_flops, bandwidth, intensity):
    """Returns "memory" when I < I* and "compute" otherwise (at I = I* it is "compute")."""
    # TODO: compare the intensity with the ridge point
    raise NotImplementedError
