"""Hidden tests: chapter numbers, non-square shapes, unaligned rows and one-line cache.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821


def test_hidden_chapter_numbers():
    assert count_misses("rows", 1000, 1000, 1) == 125_000
    assert count_misses("cols", 1000, 1000, 512) == 1_000_000


def test_hidden_big_cache_columns_equal_rows():
    assert count_misses("cols", 1000, 1000, 2048) == 125_000


def test_hidden_non_square_matrix():
    # 3 rows x 16 cols, 64-byte lines: a row is 128 bytes = 2 lines.
    assert count_misses("rows", 3, 16, 1) == 6
    assert count_misses("cols", 3, 16, 1) == 48
    assert count_misses("cols", 3, 16, 6) == 6


def test_hidden_unaligned_rows():
    # 5 columns = 40 bytes per row: lines are shared between neighbouring rows.
    # 4 rows -> 160 bytes -> 3 lines of 64 bytes (0-63, 64-127, 128-159).
    assert count_misses("rows", 4, 5, 1) == 3


def test_hidden_lru_order_matters():
    # With 2 lines the third line evicts the oldest one: column pass over 3 rows
    # cycles through 3 lines and never hits.
    assert count_misses("cols", 3, 8, 2) == 24


def test_hidden_single_element_and_bad_order():
    assert count_misses("rows", 1, 1, 1) == 1
    try:
        count_misses("diag", 2, 2, 2)
    except ValueError:
        return
    raise AssertionError("unknown order must raise ValueError")
