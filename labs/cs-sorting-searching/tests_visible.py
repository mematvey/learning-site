"""Visible tests. `merge_sorted`, `merge_sort` and `binary_search` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import random


def test_merge_sorted_small_case():
    merged = merge_sorted([1, 3, 5], [2, 4])
    expected = [1, 2, 3, 4, 5]
    assert merged == expected, f"expected {expected}, got {merged}"


def test_merge_sorted_with_empty_side():
    assert merge_sorted([], [1, 2]) == [1, 2], "empty left list: expected [1, 2]"
    assert merge_sorted([7], []) == [7], "empty right list: expected [7]"


def test_merge_sort_empty_and_single():
    assert merge_sort([]) == [], "empty list: expected []"
    assert merge_sort([4]) == [4], "one element: expected [4]"


def test_merge_sort_matches_builtin_sorted():
    rng = random.Random(0)
    xs = [rng.randint(-100, 100) for _ in range(40)]
    result = merge_sort(xs)
    expected = sorted(xs)
    assert result == expected, f"expected {expected}, got {result}"


def test_merge_sort_keeps_duplicates():
    xs = [3, 1, 3, 2, 1, 3]
    result = merge_sort(xs)
    assert result == [1, 1, 2, 3, 3, 3], f"expected [1, 1, 2, 3, 3, 3], got {result}"


def test_binary_search_found_and_absent():
    xs = [1, 3, 3, 5, 8]
    i = binary_search(xs, 5)
    assert i != -1 and xs[i] == 5, f"value 5 is in the list, got index {i}"
    j = binary_search(xs, 3)
    assert j != -1 and xs[j] == 3, f"value 3 is in the list, got index {j}"
    k = binary_search(xs, 4)
    assert k == -1, f"value 4 is not in the list: expected -1, got {k}"
