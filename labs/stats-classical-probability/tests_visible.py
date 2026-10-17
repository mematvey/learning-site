"""Visible tests. The functions and `assert_close` come from the runner."""

# ruff: noqa: F821


def test_hypergeom_hand_case():
    # exactly 2 aces in a hand of 5 from 52 cards with 4 aces: 6 * 17296 / 2598960
    p = hypergeom_pmf(52, 4, 5, 2)
    assert_close(p, 6 * 17296 / 2598960, atol=1e-9, message=f"got {p:.8f}")


def test_hypergeom_sums_to_one():
    total = sum(hypergeom_pmf(30, 10, 5, k) for k in range(6))
    assert_close(total, 1.0, atol=1e-9, message=f"sum is {total:.8f}")


def test_at_least_one():
    p = p_at_least_one(30, 10, 5)
    none = (20 * 19 * 18 * 17 * 16) / (30 * 29 * 28 * 27 * 26)
    assert_close(p, 1 - none, atol=1e-9, message=f"got {p:.8f}")


def test_multiset_permutations():
    assert multiset_permutations([2, 2]) == 6
    assert multiset_permutations([3, 2, 1]) == 60


def test_dice_sum():
    assert_close(dice_sum_prob(7), 1 / 6, atol=1e-9, message="P(sum = 7) is 6/36")
    assert_close(dice_sum_prob(2), 1 / 36, atol=1e-9, message="P(sum = 2) is 1/36")
