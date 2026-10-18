"""Visible tests. `count_misses` comes from the learner's file.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821


def test_rows_one_miss_per_line():
    # 4 x 4 doubles, 32-byte lines: 4 elements per line, so 16 / 4 = 4 misses.
    got = count_misses("rows", 4, 4, 2, line_bytes=32)
    assert got == 4, f"row traversal, 4x4, 32-byte lines: expected 4 misses, got {got}"


def test_cols_small_cache_misses_every_access():
    # One column touches 4 different lines, the cache holds only 2: no reuse.
    got = count_misses("cols", 4, 4, 2, line_bytes=32)
    assert got == 16, f"column traversal with 2 lines: expected 16 misses, got {got}"


def test_cols_big_enough_cache_reuses_lines():
    # The 4 lines of the first column serve the next three columns as well.
    got = count_misses("cols", 4, 4, 4, line_bytes=32)
    assert got == 4, f"column traversal with 4 lines: expected 4 misses, got {got}"


def test_medium_matrix():
    rows_misses = count_misses("rows", 256, 256, 128)
    assert rows_misses == 8192, f"256x256 by rows: expected 8192, got {rows_misses}"
    small = count_misses("cols", 256, 256, 128)
    assert small == 65536, f"256x256 by columns, 128 lines: expected 65536, got {small}"
    big = count_misses("cols", 256, 256, 256)
    assert big == 8192, f"256x256 by columns, 256 lines: expected 8192, got {big}"
