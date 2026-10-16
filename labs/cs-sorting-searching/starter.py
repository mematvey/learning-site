"""Merging, merge sort and binary search: starter code.

Complete the three functions so that they match the chapter text.
Do not change the names or the arguments.
"""


def merge_sorted(a, b, key=None):
    """Merge two sorted lists into one new sorted list.

    a, b: sorted lists. key: optional function, values are compared by key(value).
    On equal keys the element from `a` goes first, so the merge is stable.
    """
    # TODO: walk both lists with two indexes and take the smaller head each time.
    # Append the tails that remain after one list is exhausted.
    raise NotImplementedError


def merge_sort(xs, key=None):
    """Return a new sorted list with the elements of `xs` (stable, input unchanged)."""
    # TODO: split the list in halves, sort each half recursively, then merge with merge_sorted.
    # A list with 0 or 1 element is already sorted.
    raise NotImplementedError


def binary_search(xs, x):
    """Index of some occurrence of `x` in the sorted list `xs`, or -1 if absent."""
    # TODO: keep a half-open range [lo, hi). Compare x with the middle element
    # and move lo or hi. Stop when the range is empty.
    raise NotImplementedError
