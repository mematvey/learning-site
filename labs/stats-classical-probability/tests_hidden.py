"""Hidden tests: edge cases and scale."""

# ruff: noqa: F821


def test_hidden_impossible_k():
    assert_close(hypergeom_pmf(10, 3, 4, 5), 0.0, atol=1e-12, message="edge case")
    assert_close(hypergeom_pmf(10, 3, 4, -1), 0.0, atol=1e-12, message="edge case")
    assert_close(hypergeom_pmf(10, 3, 8, 0), 0.0, atol=1e-12, message="edge case")


def test_hidden_large_scale():
    total = sum(hypergeom_pmf(2000, 700, 300, k) for k in range(301))
    assert_close(total, 1.0, atol=1e-9, message="large sum")


def test_hidden_at_least_one_certain():
    assert_close(p_at_least_one(10, 8, 5), 1.0, atol=1e-12, message="edge case")
    assert_close(p_at_least_one(10, 0, 5), 0.0, atol=1e-12, message="edge case")


def test_hidden_multiset():
    assert multiset_permutations([1, 1, 1, 1]) == 24
    assert multiset_permutations([5]) == 1
    assert multiset_permutations([10, 10]) == 184756


def test_hidden_dice_edges():
    assert_close(dice_sum_prob(1), 0.0, atol=1e-12, message="edge case")
    assert_close(dice_sum_prob(12), 1 / 36, atol=1e-12, message="edge case")
