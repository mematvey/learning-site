"""Cache model with LRU eviction: reference solution."""

from collections import OrderedDict

ELEM_BYTES = 8  # float64 element size in bytes


def count_misses(order, rows, cols, capacity_lines, line_bytes=64):
    """Number of cache misses for one full pass over the matrix.

    order: "rows" visits (0,0), (0,1), ...; "cols" visits (0,0), (1,0), ...
    Element (i, j) has address (i * cols + j) * ELEM_BYTES and lies in the line
    with number address // line_bytes. When the cache is full and a new line
    is needed, the least recently used line is evicted.
    """
    if order == "rows":
        indices = ((i, j) for i in range(rows) for j in range(cols))
    elif order == "cols":
        indices = ((i, j) for j in range(cols) for i in range(rows))
    else:
        raise ValueError(f"unknown order: {order!r}")
    cache = OrderedDict()
    misses = 0
    for i, j in indices:
        line = (i * cols + j) * ELEM_BYTES // line_bytes
        if line in cache:
            cache.move_to_end(line)  # hit: the line becomes the most recent
        else:
            misses += 1
            cache[line] = True
            if len(cache) > capacity_lines:
                cache.popitem(last=False)  # evict the least recently used line
    return misses
