"""Hidden tests: edge cases, scale, stability and binary search over all positions.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import bisect
import random


def test_hidden_merge_sorted_random_sizes():
    rng = random.Random(0)
    for _ in range(50):
        a = sorted(rng.randint(-20, 20) for _ in range(rng.randint(0, 12)))
        b = sorted(rng.randint(-20, 20) for _ in range(rng.randint(0, 12)))
        result = merge_sorted(a, b)
        assert result == sorted(a + b), "merge_sorted mismatch on random input, seed 0"


def test_hidden_merge_sort_random_large():
    rng = random.Random(1)
    xs = [rng.randint(0, 10**6) for _ in range(5000)]
    assert merge_sort(xs) == sorted(xs), "merge_sort mismatch on large input, seed 1"


def test_hidden_merge_sort_does_not_mutate_input():
    xs = [5, 2, 9, 1]
    before = list(xs)
    merge_sort(xs)
    assert xs == before, "merge_sort must not change its input list"


def test_hidden_merge_sort_is_stable():
    rng = random.Random(2)
    items = [(rng.randint(0, 3), idx) for idx in range(60)]
    result = merge_sort(items, key=lambda p: p[0])
    expected = sorted(items, key=lambda p: p[0])
    assert result == expected, "merge_sort must keep equal keys in input order (seed 2)"


def test_hidden_merge_sorted_is_stable():
    a = [(1, "a0"), (2, "a1")]
    b = [(1, "b0"), (2, "b1")]
    result = merge_sorted(a, b, key=lambda p: p[0])
    assert result == [(1, "a0"), (1, "b0"), (2, "a1"), (2, "b1")], "merge must prefer left on ties"


def test_hidden_binary_search_matches_reference():
    rng = random.Random(3)
    for _ in range(40):
        xs = sorted(rng.randint(0, 15) for _ in range(rng.randint(0, 25)))
        for x in range(-1, 17):
            i = binary_search(xs, x)
            present = bisect.bisect_left(xs, x) < len(xs) and xs[bisect.bisect_left(xs, x)] == x
            if present:
                assert i != -1 and xs[i] == x, "binary_search missed a present value (seed 3)"
            else:
                assert i == -1, "binary_search returned an index for an absent value (seed 3)"


def test_hidden_binary_search_every_position():
    for n in range(1, 18):
        xs = list(range(0, 2 * n, 2))
        for idx, value in enumerate(xs):
            assert binary_search(xs, value) == idx, "every stored value must be found"
        assert binary_search(xs, -1) == -1, "value below the list must be absent"
        assert binary_search(xs, 2 * n + 1) == -1, "value above the list must be absent"
