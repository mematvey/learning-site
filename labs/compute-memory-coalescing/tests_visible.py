"""Visible tests. The functions of the lab come from the runner, in the same namespace."""

# ruff: noqa: F821


def test_addresses_are_in_bytes():
    # stride 2, offset 0: thread 3 reads element 6 = byte 24
    a = warp_addresses(0, 2)
    assert len(a) == 32, "a warp has 32 threads"
    assert a[3] == 24, f"thread 3 with stride 2 reads byte 24, got {a[3]}"


def test_contiguous_warp_needs_four_transactions():
    # 32 floats in a row = 128 bytes = four 32-byte segments
    t = count_transactions(warp_addresses(0, 1))
    assert t == 4, f"expected 4 transactions for stride 1, got {t}"


def test_stride_two_needs_eight_transactions():
    t = count_transactions(warp_addresses(0, 2))
    assert t == 8, f"expected 8 transactions for stride 2, got {t}"


def test_misaligned_start_adds_a_segment():
    # starting at element 1 (byte 4) the same 128 bytes touch five segments
    t = count_transactions(warp_addresses(1, 1))
    assert t == 5, f"expected 5 transactions for offset 1, got {t}"


def test_efficiency_of_stride_four():
    e = efficiency(warp_addresses(0, 4))
    assert abs(e - 0.25) < 1e-9, f"expected efficiency 0.25 for stride 4, got {e}"


def test_column_walk_has_large_stride():
    assert traversal_stride("row", 1000) == 1, "walking along a row: stride 1"
    assert traversal_stride("col", 1000) == 1000, "walking down a column: stride = n_cols"
