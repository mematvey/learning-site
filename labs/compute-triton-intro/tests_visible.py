"""Visible tests. `cdiv`, `num_programs`, `program_offsets`, `program_mask`, `add_kernel`
and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def test_cdiv_rounds_up():
    assert cdiv(10, 4) == 3, f"expected cdiv(10, 4) == 3, got {cdiv(10, 4)}"
    assert cdiv(8, 4) == 2, f"expected cdiv(8, 4) == 2, got {cdiv(8, 4)}"


def test_num_programs_with_tail():
    # 10 elements in blocks of 4: programs cover 0..11, so there are 3 of them
    assert num_programs(10, 4) == 3, f"expected 3 programs, got {num_programs(10, 4)}"
    assert num_programs(98432, 1024) == 97, f"expected 97 programs, got {num_programs(98432, 1024)}"


def test_offsets_and_mask_of_last_program():
    offsets = program_offsets(2, 4)
    assert offsets.tolist() == [8, 9, 10, 11], f"expected [8, 9, 10, 11], got {offsets.tolist()}"
    mask = program_mask(offsets, 10)
    expected = [True, True, False, False]
    assert mask.tolist() == expected, f"expected mask {expected}, got {mask.tolist()}"


def test_add_with_tail_matches_plain_sum():
    x = np.arange(10, dtype=float)
    y = np.full(10, 100.0)
    out = add_kernel(x, y, 4)
    assert out.shape == (10,), f"expected output shape (10,), got {out.shape}"
    assert_close(out, x + y, atol=1e-9, message=f"expected {(x + y).tolist()}, got {out.tolist()}")
