"""Hidden tests: more strides, segment sizes and edge cases."""

# ruff: noqa: F821


def test_hidden_transactions_table():
    expected = {1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 16: 32, 33: 32}
    for stride, want in expected.items():
        got = count_transactions(warp_addresses(0, stride))
        assert got == want, f"stride {stride}: expected {want} transactions, got {got}"


def test_hidden_efficiency_is_one_over_min_stride_8():
    for stride in (1, 2, 4, 8, 16):
        e = efficiency(warp_addresses(0, stride))
        assert abs(e - 1 / min(stride, 8)) < 1e-9, f"stride {stride}: wrong efficiency {e}"


def test_hidden_offset_multiple_of_eight_stays_aligned():
    # an offset of 8 elements = 32 bytes is a segment boundary
    assert count_transactions(warp_addresses(8, 1)) == 4, "offset 8 elements is aligned"
    assert count_transactions(warp_addresses(40, 1)) == 4, "offset 40 elements is aligned"
    assert count_transactions(warp_addresses(4, 1)) == 5, "offset 4 elements is not aligned"


def test_hidden_segment_128():
    assert count_transactions(warp_addresses(0, 1), 128) == 1, "128 contiguous bytes fit one segment"
    e = efficiency(warp_addresses(0, 32), segment_bytes=128)
    assert abs(e - 1 / 32) < 1e-9, f"stride 32 with 128-byte segments: expected 1/32, got {e}"


def test_hidden_other_element_size():
    # double (8 bytes), stride 1: 256 bytes = eight 32-byte segments
    a = warp_addresses(0, 1, elem_bytes=8)
    assert count_transactions(a) == 8, "32 doubles occupy eight segments"
    assert abs(efficiency(a, elem_bytes=8) - 1.0) < 1e-9, "contiguous doubles are fully useful"


def test_hidden_same_address_counts_once():
    assert count_transactions([0, 0, 0, 4]) == 1, "broadcast of one segment is one transaction"


def test_hidden_traversal_order_changes_efficiency():
    n_cols = 1024
    row = efficiency(warp_addresses(0, traversal_stride("row", n_cols)))
    col = efficiency(warp_addresses(0, traversal_stride("col", n_cols)))
    assert row == 1.0 and abs(col - 0.125) < 1e-9, f"row {row}, column {col}"
