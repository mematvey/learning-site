"""Hidden tests: empty tree, duplicates, deep trees and random inputs.

Messages do not reveal expected values. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import random


def build(keys):
    root = None
    for key in keys:
        root = bst_insert(root, key)
    return root


def reference_height(root):
    """Recursive height in edges, for small trees only."""
    if root is None:
        return -1
    return 1 + max(reference_height(root.left), reference_height(root.right))


def test_hidden_empty_tree():
    assert bst_height(None) == -1, "empty tree must have height -1"
    assert bst_search(None, 5) is False, "search in an empty tree must return False"


def test_hidden_single_node():
    root = build([42])
    assert bst_height(root) == 0, "single node must have height 0"
    assert bst_search(root, 42) is True


def test_hidden_duplicates_are_ignored():
    root = build([3, 3, 1, 3, 1])
    assert bst_height(root) == 1, "duplicate keys must not add nodes"
    assert bst_search(root, 1) is True and bst_search(root, 3) is True


def test_hidden_deep_chain_no_recursion_limit():
    # 1200 sorted keys make a chain deeper than Python's default recursion limit.
    n = 1200
    root = build(range(n))
    assert bst_height(root) == n - 1, "sorted keys must give a chain of height n - 1"
    assert bst_search(root, n - 1) is True, "last key of a deep chain must be found"
    assert bst_search(root, n) is False, "missing key beyond a deep chain must not be found"


def test_hidden_random_keys_match_reference():
    rng = random.Random(0)
    keys = [rng.randint(0, 10_000) for _ in range(200)]
    root = build(keys)
    expected_height = reference_height(root)
    got = bst_height(root)
    assert got == expected_height, "height mismatch on random keys, seed 0"
    present = set(keys)
    for key in range(0, 10_001, 37):
        assert bst_search(root, key) == (key in present), "search mismatch on random keys, seed 0"


def test_hidden_top_k_matches_sorted_reference():
    rng = random.Random(1)
    values = [rng.randint(-500, 500) for _ in range(300)]
    for k in (1, 5, 17, 300):
        expected = sorted(values, reverse=True)[:k]
        assert top_k(values, k) == expected, "top_k mismatch on random input, seed 1"


def test_hidden_top_k_edge_k():
    assert top_k([1, 2, 3], 0) == [], "k = 0 must return an empty list"
    assert top_k([], 5) == [], "empty input must return an empty list"
    assert top_k(iter([4, 8, 6]), 2) == [8, 6], "top_k must accept any iterable"
