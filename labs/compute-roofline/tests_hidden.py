"""Hidden tests: edge cases, batching, invalid input and consistency.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np

PEAK_FP16_DENSE = 989e12
BANDWIDTH = 3.35e12


def _raises_value_error(fn, *args):
    try:
        fn(*args)
    except ValueError:
        return True
    return False


def test_hidden_ridge_point_itself_is_compute():
    ridge = ridge_point(PEAK_FP16_DENSE, BANDWIDTH)
    assert limiting_factor(PEAK_FP16_DENSE, BANDWIDTH, ridge) == "compute", (
        "at the ridge point the limit is compute"
    )
    perf = attainable_performance(PEAK_FP16_DENSE, BANDWIDTH, ridge)
    assert abs(perf - PEAK_FP16_DENSE) <= 1e-9 * PEAK_FP16_DENSE, "at the ridge the roof is reached"


def test_hidden_zero_intensity_gives_zero_performance():
    assert attainable_performance(PEAK_FP16_DENSE, BANDWIDTH, 0.0) == 0.0, (
        "no FLOPs means no performance"
    )
    assert limiting_factor(PEAK_FP16_DENSE, BANDWIDTH, 0.0) == "memory"


def test_hidden_zero_flops_is_zero_intensity():
    assert arithmetic_intensity(0, 1024) == 0.0, "a copy kernel has zero intensity"


def test_hidden_decode_batch_raises_intensity_linearly():
    # One FP16 linear layer d x d: 2 d^2 FLOPs per token, weights read once per step
    d = 4096
    for batch in (1, 2, 16, 64, 512):
        i = arithmetic_intensity(2 * d * d * batch, 2 * d * d)
        assert abs(i - batch) <= 1e-9 * batch, (
            f"intensity for batch {batch} must be about {batch}, got {i}"
        )
    assert limiting_factor(PEAK_FP16_DENSE, BANDWIDTH, 1.0) == "memory", "batch 1 is memory bound"
    assert limiting_factor(PEAK_FP16_DENSE, BANDWIDTH, 64.0) == "memory", "batch 64 is memory bound"
    assert limiting_factor(PEAK_FP16_DENSE, BANDWIDTH, 512.0) == "compute", (
        "batch 512 is compute bound"
    )


def test_hidden_curve_matches_scalar_formula():
    rng = np.random.default_rng(0)
    intensities = rng.uniform(0.0, 2000.0, size=200)
    curve = roofline_curve(PEAK_FP16_DENSE, BANDWIDTH, intensities)
    expected = np.array(
        [attainable_performance(PEAK_FP16_DENSE, BANDWIDTH, float(x)) for x in intensities]
    )
    assert curve.shape == intensities.shape, "output shape must match the input shape"
    assert np.allclose(curve, expected, rtol=1e-12, atol=0.0), "mismatch on random input, seed 0"


def test_hidden_curve_is_monotone_and_capped():
    intensities = np.linspace(0.0, 1000.0, 501)
    curve = roofline_curve(PEAK_FP16_DENSE, BANDWIDTH, intensities)
    assert np.all(np.diff(curve) >= 0), "the roofline never goes down"
    assert np.all(curve <= PEAK_FP16_DENSE * (1 + 1e-12)), "no value may exceed the peak"


def test_hidden_limiting_factor_agrees_with_roof():
    rng = np.random.default_rng(0)
    for x in rng.uniform(0.01, 1000.0, size=300):
        x = float(x)
        memory = limiting_factor(PEAK_FP16_DENSE, BANDWIDTH, x) == "memory"
        below_roof = attainable_performance(PEAK_FP16_DENSE, BANDWIDTH, x) < PEAK_FP16_DENSE
        assert memory == below_roof, "mismatch on random input, seed 0"


def test_hidden_invalid_inputs_raise_value_error():
    assert _raises_value_error(arithmetic_intensity, 10, 0), "zero bytes must be rejected"
    assert _raises_value_error(ridge_point, 0.0, BANDWIDTH), "zero peak must be rejected"
    assert _raises_value_error(ridge_point, PEAK_FP16_DENSE, -1.0), "negative bandwidth"
    assert _raises_value_error(attainable_performance, PEAK_FP16_DENSE, BANDWIDTH, -0.5), (
        "negative intensity must be rejected"
    )
    assert _raises_value_error(roofline_curve, PEAK_FP16_DENSE, 0.0, [1.0, 2.0]), (
        "zero bandwidth must be rejected for arrays too"
    )
