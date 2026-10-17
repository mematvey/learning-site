"""Cache model with LRU eviction: starter code.

A matrix of `rows` x `cols` elements is stored row by row (row-major order).
The cache holds `capacity_lines` lines of `line_bytes` bytes each. Count the
misses of a full traversal of the matrix.
"""

ELEM_BYTES = 8  # float64 element size in bytes


def count_misses(order, rows, cols, capacity_lines, line_bytes=64):
    """Number of cache misses for one full pass over the matrix.

    order: "rows" visits (0,0), (0,1), ...; "cols" visits (0,0), (1,0), ...
    Element (i, j) has address (i * cols + j) * ELEM_BYTES and lies in the line
    with number address // line_bytes. When the cache is full and a new line
    is needed, the least recently used line is evicted.
    """
    # TODO: build the sequence of (i, j) for the given order
    # TODO: keep an ordered collection of line numbers; a hit moves the line to
    #       the "recent" end, a miss counts and evicts the oldest line if over capacity
    raise NotImplementedError
