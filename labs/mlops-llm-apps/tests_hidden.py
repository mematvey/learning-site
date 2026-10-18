"""Hidden tests: edge cases, short rankings, errors and agreement with a brute-force reference.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import itertools
import random


def _recall_reference(ranked, relevant, k):
    """Brute force: walk the ranking one item at a time and count relevant hits."""
    relevant = set(relevant)
    hits = set()
    for i, item in enumerate(ranked):
        if i >= k:
            break
        if item in relevant:
            hits.add(item)
    return len(hits) / len(relevant)


def test_hidden_recall_k_zero_and_short_ranking():
    assert_close(recall_at_k(["a", "b"], {"a"}, 0), 0.0, atol=1e-12, message="k = 0 gives 0")
    assert_close(
        recall_at_k(["a", "b"], {"a", "b"}, 10),
        1.0,
        atol=1e-12,
        message="k larger than the ranking must use the whole ranking",
    )


def test_hidden_recall_matches_reference_on_random_rankings():
    rng = random.Random(0)
    for case in range(50):
        pool = [f"c{i}" for i in range(40)]
        ranked = rng.sample(pool, 25)
        relevant = set(rng.sample(pool, rng.randint(1, 12)))
        k = rng.randint(0, 30)
        assert_close(
            recall_at_k(ranked, relevant, k),
            _recall_reference(ranked, relevant, k),
            atol=1e-12,
            message=f"mismatch on random ranking, seed 0, case {case}",
        )


def test_hidden_recall_is_monotone_in_k():
    rng = random.Random(1)
    pool = [f"c{i}" for i in range(30)]
    ranked = rng.sample(pool, 30)
    relevant = set(rng.sample(pool, 8))
    values = [recall_at_k(ranked, relevant, k) for k in range(31)]
    assert all(b >= a for a, b in itertools.pairwise(values)), "recall@k must not decrease with k"
    assert_close(values[-1], 1.0, atol=1e-12, message="recall over the full ranking must be 1")


def test_hidden_recall_without_relevant_raises():
    try:
        recall_at_k(["a"], [], 1)
    except ValueError:
        return
    raise AssertionError("recall@k with no relevant chunks must raise ValueError")


def test_hidden_input_tokens_is_linear():
    base = input_tokens(0, 300, 500)
    assert base == 500, f"with k = 0 only the prompt counts, got {base}"
    step = input_tokens(1, 300, 500) - base
    assert step == 300, f"each chunk adds chunk_tokens, got {step}"
    assert input_tokens(7, 128, 0) == 896, "expected 7 * 128 = 896 with an empty prompt"


def test_hidden_standard_error_is_largest_at_half():
    values = [standard_error(p, 100) for p in (0.1, 0.3, 0.5, 0.7, 0.9)]
    assert all(v > 0 for v in values), f"standard error must be positive, got {values}"
    assert max(values) == values[2], "the standard error is largest at p = 0.5"
    assert_close(
        standard_error(0.5, 100), 0.05, atol=1e-12, message="expected sqrt(0.25 / 100) = 0.05"
    )


def test_hidden_pass_rate_empty_raises():
    try:
        pass_rate([])
    except ValueError:
        return
    raise AssertionError("pass rate of an empty golden set must raise ValueError")


def test_hidden_regression_threshold_is_inclusive():
    outcomes = [True] * 9 + [False]
    assert regression_check(outcomes, 0.9) is True, "a rate equal to the threshold must pass"
    assert regression_check(outcomes, 0.91) is False, "a rate below the threshold must fail"
    assert regression_check([True, True, True], 1.0) is True, "a perfect set passes threshold 1"
