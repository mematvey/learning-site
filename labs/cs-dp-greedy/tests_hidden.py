"""Hidden tests: edge cases and comparison with brute force.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import itertools
import random


def _edit_reference(a, b):
    """Exact recursive definition, no table. Only for very short strings."""
    if not a:
        return len(b)
    if not b:
        return len(a)
    if a[0] == b[0]:
        return _edit_reference(a[1:], b[1:])
    return 1 + min(
        _edit_reference(a[1:], b),
        _edit_reference(a, b[1:]),
        _edit_reference(a[1:], b[1:]),
    )


def _knapsack_brute(items, capacity):
    best = 0
    for mask in range(1 << len(items)):
        weight = sum(items[i][1] for i in range(len(items)) if mask >> i & 1)
        value = sum(items[i][0] for i in range(len(items)) if mask >> i & 1)
        if weight <= capacity and value > best:
            best = value
    return best


def test_hidden_edit_distance_empty_both():
    assert edit_distance("", "") == 0, "mismatch on empty strings"


def test_hidden_edit_distance_matches_reference():
    words = [""] + ["".join(p) for n in range(1, 4) for p in itertools.product("ab", repeat=n)]
    for a in words:
        for b in words:
            got = edit_distance(a, b)
            want = _edit_reference(a, b)
            assert got == want, f"mismatch on a pair of short strings: got {got}, expected {want}"


def test_hidden_edit_distance_symmetric():
    pairs = [("sunday", "saturday"), ("intention", "execution"), ("abc", "xyz")]
    for a, b in pairs:
        assert edit_distance(a, b) == edit_distance(b, a), "edit distance must be symmetric"


def test_hidden_knapsack_empty_and_zero_capacity():
    assert knapsack([], 10) == (0, []), "no items must give (0, [])"
    best, chosen = knapsack([(5, 1), (7, 2)], 0)
    assert best == 0 and chosen == [], "zero capacity must give (0, [])"


def test_hidden_knapsack_item_too_heavy():
    best, chosen = knapsack([(100, 50), (10, 1)], 5)
    assert best == 10 and chosen == [1], "item heavier than capacity must not be taken"


def test_hidden_knapsack_matches_brute_force():
    rng = random.Random(0)
    for _ in range(30):
        n = rng.randint(1, 7)
        items = [(rng.randint(1, 30), rng.randint(1, 12)) for _ in range(n)]
        capacity = rng.randint(0, 40)
        best, chosen = knapsack(items, capacity)
        assert best == _knapsack_brute(items, capacity), "best value differs from brute force"
        assert len(set(chosen)) == len(chosen), "chosen indices must be unique"
        assert all(0 <= i < n for i in chosen), "chosen index out of range"
        assert sum(items[i][1] for i in chosen) <= capacity, "chosen items exceed capacity"
        assert sum(items[i][0] for i in chosen) == best, "chosen items must give best value"


def test_hidden_min_coins_impossible():
    assert min_coins([2], 3) == -1, "unreachable amount must give -1"


def test_hidden_min_coins_zero_amount():
    assert min_coins([1, 3, 4], 0) == 0, "amount 0 must need 0 coins"


def test_hidden_min_coins_classic():
    assert min_coins([1, 2, 5], 11) == 3, "mismatch on coins [1, 2, 5], amount 11"


def test_hidden_greedy_stuck_returns_none():
    assert greedy_coins([4, 3], 6) is None, "greedy that cannot reach the amount must return None"


def test_hidden_greedy_optimal_on_canonical_coins():
    taken = greedy_coins([1, 2, 5], 11)
    assert taken is not None and sum(taken) == 11, "greedy must reach the amount"
    assert len(taken) == min_coins([1, 2, 5], 11), "greedy is optimal for canonical coins"
