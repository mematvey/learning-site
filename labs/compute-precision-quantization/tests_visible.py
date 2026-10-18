"""Visible tests. The functions of the lab come from the runner, in the same namespace.

The runner executes starter.py (or solution.py) first, then this file.
"""

# ruff: noqa: F821
import numpy as np


def test_fp16_rounds_1000_7_to_1000_5():
    y = to_fp16(1000.7)
    assert y == 1000.5, f"expected fp16(1000.7) = 1000.5, got {y}"


def test_fp16_overflow_gives_inf():
    y = to_fp16(70000.0)
    assert np.isinf(y), f"expected inf for 70000 in fp16, got {y}"


def test_bf16_rounds_1000_7_to_1000():
    y = to_bf16(1000.7)
    assert y == 1000.0, f"expected bf16(1000.7) = 1000.0, got {y}"


def test_bf16_keeps_large_values_finite():
    y = to_bf16(70000.0)
    assert np.isfinite(y), f"bf16 has the fp32 range, 70000 must stay finite, got {y}"


def test_format_max_values():
    assert format_max("fp16") == 65504.0, f"fp16 max is 65504, got {format_max('fp16')}"
    assert format_max("e4m3") == 448.0, f"E4M3 max is 448, got {format_max('e4m3')}"
    assert format_max("e5m2") == 57344.0, f"E5M2 max is 57344, got {format_max('e5m2')}"


def test_quantize_int_single_group_example():
    # int4: qmax = 7. For [-7, 0, 3.5, 7] the scale is 7 / 7 = 1.0.
    q, scales = quantize_int(np.array([-7.0, 0.0, 3.5, 7.0]), 4)
    assert scales.shape == (1,), f"expected one scale, got shape {scales.shape}"
    assert scales[0] == 1.0, f"expected scale 1.0, got {scales[0]}"
    assert q.tolist() == [-7, 0, 4, 7], f"expected codes [-7, 0, 4, 7], got {q.tolist()}"


def test_quantize_int_groups_have_own_scales():
    # Two groups of 2: [1, 1] has scale 1/7, [100, 100] has scale 100/7.
    x = np.array([1.0, 1.0, 100.0, 100.0])
    q, scales = quantize_int(x, 4, group_size=2)
    assert scales.shape == (2,), f"expected 2 scales, got shape {scales.shape}"
    assert np.allclose(scales, [1 / 7, 100 / 7]), f"expected scales [1/7, 100/7], got {scales}"
    assert q.tolist() == [7, 7, 7, 7], f"expected codes [7, 7, 7, 7], got {q.tolist()}"


def test_dequantize_restores_exact_grid_values():
    x = np.array([1.0, 1.0, 100.0, 100.0])
    q, scales = quantize_int(x, 4, group_size=2)
    x_hat = dequantize_int(q, scales)
    assert np.allclose(x_hat, x, rtol=1e-12, atol=1e-12), f"expected {x.tolist()}, got {x_hat}"


def test_relative_error_zero_for_exact_values():
    x = np.array([1.0, -2.0, 3.0])
    err = relative_error(x, x)
    assert err == 0.0, f"expected error 0 for identical vectors, got {err}"


def test_group_scale_reduces_error_on_outliers():
    # Every 256th value is 20 times larger. Int4 with one scale for the whole vector
    # loses most of the normal values; a group of 32 keeps them.
    x = make_outlier_vector(4096, seed=0)
    q1, s1 = quantize_int(x, 4)
    e_whole = relative_error(x, dequantize_int(q1, s1))
    q32, s32 = quantize_int(x, 4, group_size=32)
    e_group = relative_error(x, dequantize_int(q32, s32))
    assert e_whole > 0.60, f"int4 with one scale: expected error above 0.60, got {e_whole:.3f}"
    assert e_group < 0.20, f"int4 with group 32: expected error below 0.20, got {e_group:.3f}"
    assert e_group < e_whole, f"group error {e_group:.3f} must be below whole-vector {e_whole:.3f}"


def test_int8_group_error_is_small():
    x = make_outlier_vector(4096, seed=0)
    q, s = quantize_int(x, 8, group_size=32)
    err = relative_error(x, dequantize_int(q, s))
    assert err < 0.02, f"int8 with group 32: expected error below 0.02, got {err:.4f}"
