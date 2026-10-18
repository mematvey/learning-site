"""Visible tests. The functions of the lab come from the runner, in the same namespace.

The runner executes starter.py (or solution.py) first, then this file.
Units: FLOP/s, byte/s, FLOP/byte. 1 TFLOPS = 1e12 FLOP/s, 1 TB/s = 1e12 byte/s.
"""

# ruff: noqa: F821

PEAK_FP32 = 67e12  # FP32 on ordinary cores, dense
PEAK_FP16_DENSE = 989e12  # FP16 on tensor cores, dense
BANDWIDTH = 3.35e12  # HBM bandwidth


def _close(actual, expected, rtol, what):
    assert abs(actual - expected) <= rtol * abs(expected), (
        f"{what}: expected about {expected}, got {actual}"
    )


def test_arithmetic_intensity_vector_add():
    # FP32 vector addition: one FLOP per element, 12 bytes moved per element
    n = 1_000_000
    i = arithmetic_intensity(n, 12 * n)
    _close(i, 1 / 12, 1e-12, "intensity of vector addition")


def test_ridge_point_fp16_tensor_cores():
    # 989 / 3.35 is about 295 FLOP per byte
    ridge = ridge_point(PEAK_FP16_DENSE, BANDWIDTH)
    _close(ridge, 295, 0.01, "ridge point for FP16 dense")


def test_ridge_point_fp32_ordinary_cores():
    # 67 / 3.35 = 20 FLOP per byte
    ridge = ridge_point(PEAK_FP32, BANDWIDTH)
    _close(ridge, 20, 0.01, "ridge point for FP32")


def test_intensity_one_is_memory_bound():
    # One FLOP per byte with 3.35 TB/s gives 3.35 TFLOPS, far below the peak
    perf = attainable_performance(PEAK_FP32, BANDWIDTH, 1.0)
    _close(perf, 3.35e12, 1e-9, "attainable performance at I = 1")
    assert limiting_factor(PEAK_FP32, BANDWIDTH, 1.0) == "memory", "I = 1 is below the ridge"


def test_vector_add_attainable_is_a_fraction_of_peak():
    # 1/12 FLOP per byte times 3.35 TB/s is about 0.28 TFLOPS, roughly 0.4% of 67 TFLOPS
    perf = attainable_performance(PEAK_FP32, BANDWIDTH, 1 / 12)
    _close(perf, 0.28e12, 0.01, "attainable performance of vector addition")


def test_large_matmul_is_compute_bound():
    # N = 4096, FP16, each matrix read once: I = N / 3, about 1365 FLOP per byte
    n = 4096
    i = arithmetic_intensity(2 * n**3, 6 * n**2)
    _close(i, n / 3, 1e-9, "intensity of matrix multiplication")
    assert limiting_factor(PEAK_FP16_DENSE, BANDWIDTH, i) == "compute", "matmul is above the ridge"
    perf = attainable_performance(PEAK_FP16_DENSE, BANDWIDTH, i)
    _close(perf, PEAK_FP16_DENSE, 1e-9, "attainable performance of matrix multiplication")


def test_roofline_curve_returns_array_of_same_shape():
    intensities = [[0.5, 2.0], [400.0, 1.0]]
    curve = roofline_curve(PEAK_FP16_DENSE, BANDWIDTH, intensities)
    assert curve.shape == (2, 2), f"expected shape (2, 2), got {curve.shape}"
    assert abs(curve[1, 0] - PEAK_FP16_DENSE) <= 1e-9 * PEAK_FP16_DENSE, (
        "above the ridge the curve is the flat roof"
    )
