"""Hidden tests. Edge cases and properties; messages do not reveal expected values.

The runner executes starter.py (or solution.py) first, then this file.
"""

# ruff: noqa: F821
import numpy as np


def _ulp_bf16(x):
    # Spacing of bfloat16 values around x (normal numbers): 2**(exponent - 7)
    _, e = np.frexp(x)
    return np.ldexp(1.0, e - 1 - 7)


def test_bf16_low_bits_are_clear():
    rng = np.random.default_rng(0)
    x = rng.standard_normal(500) * 10.0 ** rng.uniform(-3, 3, 500)
    y = np.asarray(to_bf16(x), dtype=np.float64)
    bits = np.asarray(y, dtype=np.float32).view(np.uint32)
    assert np.all((bits & 0xFFFF) == 0), "mismatch on random input, seed 0"


def test_bf16_error_within_half_ulp():
    rng = np.random.default_rng(1)
    # The input is first stored as float32 (the rounding works on float32 bits).
    x = (rng.standard_normal(500) * 10.0 ** rng.uniform(-3, 3, 500)).astype(np.float32)
    x = x.astype(np.float64)
    y = np.asarray(to_bf16(x), dtype=np.float64)
    ok = np.abs(x - y) <= _ulp_bf16(x) / 2 * (1 + 1e-12)
    assert np.all(ok), "mismatch on random input, seed 1"


def test_bf16_ties_to_even():
    # 1 + 2**-8 lies exactly between 1.0 and 1 + 2**-7; the even mantissa (1.0) wins.
    assert to_bf16(1.0 + 2.0**-8) == 1.0, "mismatch on tie, seed 0"
    # 1 + 3 * 2**-8 lies between 1 + 2**-7 (odd) and 1 + 2**-6 (even); the even one wins.
    assert to_bf16(1.0 + 3 * 2.0**-8) == 1.0 + 2.0**-6, "mismatch on tie, seed 1"


def test_fp16_matches_numpy_cast():
    rng = np.random.default_rng(2)
    x = rng.standard_normal(500) * 10.0 ** rng.uniform(-4, 4, 500)
    with np.errstate(over="ignore"):
        expected = x.astype(np.float16).astype(np.float64)
    got = np.asarray(to_fp16(x), dtype=np.float64)
    assert np.array_equal(got, expected), "mismatch on random input, seed 2"


def test_format_max_unknown_name_raises():
    try:
        format_max("fp4")
    except ValueError:
        return
    raise AssertionError("format_max must raise ValueError for an unknown format")


def test_bf16_max_close_to_fp32_max():
    m = format_max("bf16")
    fp32_max = float(np.finfo(np.float32).max)
    assert abs(m - 3.3895e38) / 3.3895e38 < 1e-3, "mismatch on bf16 maximum"
    assert m < fp32_max, "bf16 maximum must be below the fp32 maximum"


def test_int4_codes_stay_in_symmetric_range():
    rng = np.random.default_rng(3)
    x = rng.standard_normal(256)
    q, _ = quantize_int(x, 4, group_size=16)
    assert q.min() >= -7 and q.max() <= 7, "mismatch on random input, seed 3"


def test_int_error_bounded_by_half_scale():
    rng = np.random.default_rng(4)
    x = rng.standard_normal(512)
    for bits, g in [(4, 32), (8, 64)]:
        q, s = quantize_int(x, bits, group_size=g)
        x_hat = dequantize_int(q, s)
        per_value_scale = np.repeat(np.asarray(s, dtype=np.float64), g)
        ok = np.abs(x - x_hat) <= per_value_scale / 2 * (1 + 1e-9) + 1e-12
        assert np.all(ok), f"mismatch on random input, seed 4, bits {bits}"


def test_zero_group_gives_zero_codes_and_no_nan():
    x = np.array([0.0, 0.0, 2.0, -2.0])
    q, s = quantize_int(x, 4, group_size=2)
    x_hat = dequantize_int(q, s)
    assert np.all(np.isfinite(x_hat)), "mismatch on zero group, seed 0"
    assert np.all(q[:2] == 0), "mismatch on zero group, seed 0"


def test_int8_more_precise_than_int4():
    x = make_outlier_vector(4096, seed=1)
    e4 = relative_error(x, dequantize_int(*quantize_int(x, 4, group_size=32)))
    e8 = relative_error(x, dequantize_int(*quantize_int(x, 8, group_size=32)))
    assert e8 < e4, "mismatch on outlier vector, seed 1"


def test_smaller_groups_reduce_error():
    x = make_outlier_vector(4096, seed=2)
    errors = []
    for g in (None, 128, 32):
        q, s = quantize_int(x, 4, group_size=g)
        errors.append(relative_error(x, dequantize_int(q, s)))
    assert errors[0] > errors[1] > errors[2], "mismatch on outlier vector, seed 2"


def test_scales_count_matches_groups():
    x = np.arange(1, 65, dtype=np.float64)
    _, s = quantize_int(x, 8, group_size=8)
    assert s.shape == (8,), "mismatch on group count, seed 0"


def test_quantize_is_deterministic():
    x = make_outlier_vector(4096, seed=5)
    q1, s1 = quantize_int(x, 4, group_size=32)
    q2, s2 = quantize_int(x, 4, group_size=32)
    assert np.array_equal(q1, q2) and np.array_equal(s1, s2), "mismatch on repeated run, seed 5"
