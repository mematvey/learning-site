"""Visible tests. `edit_distance`, `knapsack`, `min_coins` and `greedy_coins` come from the learner's file."""

# ruff: noqa: F821


def test_edit_distance_kitten_sitting():
    got = edit_distance("kitten", "sitting")
    assert got == 3, f"expected edit_distance('kitten', 'sitting') == 3, got {got}"


def test_edit_distance_cyrillic_one_substitution():
    got = edit_distance("кот", "кит")
    assert got == 1, f"expected edit_distance('кот', 'кит') == 1, got {got}"


def test_edit_distance_empty_string():
    got = edit_distance("", "abc")
    assert got == 3, f"expected edit_distance('', 'abc') == 3, got {got}"


def test_knapsack_value_and_items():
    items = [(60, 10), (100, 20), (120, 30)]
    best, chosen = knapsack(items, 50)
    assert best == 220, f"expected best value 220 for capacity 50, got {best}"
    assert sorted(chosen) == [1, 2], f"expected items [1, 2] (0-based), got {sorted(chosen)}"


def test_min_coins_dp_beats_greedy():
    got = min_coins([1, 3, 4], 6)
    assert got == 2, f"expected min_coins([1, 3, 4], 6) == 2, got {got}"


def test_greedy_coins_is_three_coins():
    got = greedy_coins([1, 3, 4], 6)
    assert got == [4, 1, 1], f"expected greedy coins [4, 1, 1] for amount 6, got {got}"
