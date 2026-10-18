"""Warp transaction counter: reference solution.

One warp of 32 threads reads float32 values. The functions below count how many
aligned memory segments (transactions) the warp touches and how many of the
transferred bytes are useful.
"""

WARP_SIZE = 32
ELEM_BYTES = 4


def warp_addresses(offset, stride, elem_bytes=ELEM_BYTES, warp_size=WARP_SIZE):
    """Byte addresses read by the threads of a warp: (offset + t * stride) * elem_bytes."""
    return [(offset + t * stride) * elem_bytes for t in range(warp_size)]


def count_transactions(addresses, segment_bytes=32):
    """Number of distinct aligned segments of `segment_bytes` bytes that hold the addresses."""
    return len({address // segment_bytes for address in addresses})


def efficiency(addresses, elem_bytes=ELEM_BYTES, segment_bytes=32):
    """Share of transferred bytes that the threads asked for: useful / moved."""
    useful = len(addresses) * elem_bytes
    moved = count_transactions(addresses, segment_bytes) * segment_bytes
    return useful / moved


def traversal_stride(order, n_cols):
    """Stride, in elements, between neighbouring threads when a row-major matrix with
    n_cols columns is walked by "row" (thread t takes element t of a row) or by
    "col" (thread t takes the element of row t in one column)."""
    if order == "row":
        return 1
    if order == "col":
        return n_cols
    raise ValueError(f"unknown order: {order!r}")
