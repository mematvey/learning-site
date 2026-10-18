"""Visible tests. `recall_at_k`, `input_tokens`, `standard_error`, `pass_rate`,
`regression_check` and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821


def test_recall_hand_case_from_chapter():
    # Ranking a, b, c, d, e; relevant a and c plus eight other chunks: |R5 & G| = 2, |G| = 10.
    relevant = ["a", "c"] + [f"x{i}" for i in range(8)]
    value = recall_at_k(["a", "b", "c", "d", "e"], relevant, 5)
    assert_close(value, 0.2, atol=1e-12, message=f"expected recall@5 = 0.2, got {value}")


def test_recall_grows_with_k():
    ranked = ["r1", "n1", "r2", "n2", "r3", "n3", "r4", "n4", "n5", "r5"]
    relevant = {"r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9", "r10"}
    at5 = recall_at_k(ranked, relevant, 5)
    at10 = recall_at_k(ranked, relevant, 10)
    assert_close(at5, 0.3, atol=1e-12, message=f"expected recall@5 = 0.3 (3 of 10), got {at5}")
    assert_close(at10, 0.5, atol=1e-12, message=f"expected recall@10 = 0.5 (5 of 10), got {at10}")


def test_input_tokens_example_from_chapter():
    # k = 5 and k = 10 with 300-token chunks and a 500-token prompt.
    assert input_tokens(5, 300, 500) == 2000, "expected 2000 tokens for k = 5"
    assert input_tokens(10, 300, 500) == 3500, "expected 3500 tokens for k = 10"


def test_standard_error_matches_chapter():
    # p = 0.92 on N = 50 gives about 0.038 in the chapter.
    value = standard_error(0.92, 50)
    assert_close(value, 0.0384, atol=1e-4, message=f"expected about 0.0384, got {value:.4f}")


def test_pass_rate_and_regression_check():
    outcomes = [True] * 46 + [False] * 4
    rate = pass_rate(outcomes)
    assert_close(rate, 0.92, atol=1e-12, message=f"expected pass rate 0.92, got {rate}")
    assert regression_check(outcomes, 0.9) is True, "0.92 must pass a 0.9 threshold"
    assert regression_check(outcomes, 0.95) is False, "0.92 must fail a 0.95 threshold"
