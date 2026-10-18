"""Visible tests. `bst_insert`, `bst_search`, `bst_height` and `top_k` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
Heights are counted in edges: a chain of 7 nodes has height 6, a tree of 3 levels has height 2.
"""

# ruff: noqa: F821


def build(keys):
    root = None
    for key in keys:
        root = bst_insert(root, key)
    return root


def test_search_finds_inserted_keys():
    root = build([4, 2, 6, 1, 3, 5, 7])
    for key in [4, 2, 6, 1, 3, 5, 7]:
        assert bst_search(root, key) is True, (
            f"key {key} was inserted but bst_search returned False"
        )
    for key in [0, 8]:
        assert bst_search(root, key) is False, (
            f"key {key} was never inserted but bst_search returned True"
        )


def test_sorted_insert_makes_a_chain():
    # Keys 1..7 inserted in ascending order: each key goes right of the previous one.
    root = build([1, 2, 3, 4, 5, 6, 7])
    height = bst_height(root)
    assert height == 6, f"expected height 6 (7 nodes in a chain), got {height}"


def test_balanced_order_gives_small_height():
    # The same keys inserted as 4, 2, 6, 1, 3, 5, 7 form 3 levels: height 2.
    root = build([4, 2, 6, 1, 3, 5, 7])
    height = bst_height(root)
    assert height == 2, f"expected height 2 (3 levels), got {height}"


def test_top_k_with_duplicates():
    result = top_k([5, 1, 9, 3, 7, 9, 2], 3)
    assert result == [9, 9, 7], f"expected [9, 9, 7], got {result}"


def test_top_k_larger_than_input():
    result = top_k([3, 1, 2], 10)
    assert result == [3, 2, 1], f"expected [3, 2, 1], got {result}"
