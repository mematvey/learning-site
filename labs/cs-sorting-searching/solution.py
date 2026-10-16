"""Merging, merge sort and binary search: reference solution."""


def _identity(x):
    return x


def merge_sorted(a, b, key=None):
    """Merge two sorted lists into one new sorted list.

    a, b: sorted lists. key: optional function, values are compared by key(value).
    On equal keys the element from `a` goes first, so the merge is stable.
    """
    if key is None:
        key = _identity
    out = []
    i = 0
    j = 0
    while i < len(a) and j < len(b):
        # Take from b only when it is strictly smaller: ties keep the left element first.
        if key(b[j]) < key(a[i]):
            out.append(b[j])
            j += 1
        else:
            out.append(a[i])
            i += 1
    out.extend(a[i:])
    out.extend(b[j:])
    return out


def merge_sort(xs, key=None):
    """Return a new sorted list with the elements of `xs` (stable, input unchanged)."""
    if len(xs) <= 1:
        return list(xs)
    mid = len(xs) // 2
    left = merge_sort(xs[:mid], key=key)
    right = merge_sort(xs[mid:], key=key)
    return merge_sorted(left, right, key=key)


def binary_search(xs, x):
    """Index of some occurrence of `x` in the sorted list `xs`, or -1 if absent."""
    lo = 0
    hi = len(xs)
    # Invariant: if x is in xs, it lies in xs[lo:hi].
    while lo < hi:
        mid = (lo + hi) // 2
        if xs[mid] == x:
            return mid
        if x < xs[mid]:
            hi = mid
        else:
            lo = mid + 1
    return -1
