"""Warp transaction counter: starter code.

One warp of 32 threads reads float32 values. Complete the `# TODO` parts so that
they match the chapter text "Доступ к памяти и коалесцирование".
"""

WARP_SIZE = 32
ELEM_BYTES = 4


def warp_addresses(offset, stride, elem_bytes=ELEM_BYTES, warp_size=WARP_SIZE):
    """Byte addresses read by the threads of a warp.

    Thread t reads element offset + t * stride, each element has elem_bytes bytes.
    """
    # TODO: multiply the element index by elem_bytes to get a byte address
    return [offset + t * stride for t in range(warp_size)]


def count_transactions(addresses, segment_bytes=32):
    """Number of distinct aligned segments of `segment_bytes` bytes that hold the addresses."""
    # TODO: the segment of an address is address // segment_bytes; count distinct segments
    return len(addresses)


def efficiency(addresses, elem_bytes=ELEM_BYTES, segment_bytes=32):
    """Share of transferred bytes that the threads asked for: useful / moved."""
    # TODO: useful = number of addresses * elem_bytes; moved = transactions * segment_bytes
    return 1.0


def traversal_stride(order, n_cols):
    """Stride, in elements, between neighbouring threads for a row-major matrix.

    "row": thread t takes element t of a row. "col": thread t takes row t of one column.
    """
    # TODO: neighbours differ by 1 element along a row and by n_cols along a column
    return 1
