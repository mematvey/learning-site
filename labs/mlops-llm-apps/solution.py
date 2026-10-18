"""RAG retrieval metrics and a prompt regression check: reference solution."""

import math


def recall_at_k(ranked_ids, relevant_ids, k):
    """Recall@k: share of relevant chunks found in the first k retrieved ones.

    `ranked_ids` is the retrieved list in rank order, `relevant_ids` the set of
    relevant chunk ids. Returns |top-k & relevant| / |relevant| as a float in [0, 1].
    If `k` exceeds the length of `ranked_ids`, all retrieved chunks are used.
    Raise ValueError when `relevant_ids` is empty.
    """
    relevant = set(relevant_ids)
    if not relevant:
        raise ValueError("recall@k is undefined when there are no relevant chunks")
    top = set(list(ranked_ids)[:k])
    return len(top & relevant) / len(relevant)


def input_tokens(k, chunk_tokens, prompt_tokens):
    """Approximate input size in tokens: k retrieved chunks plus the prompt itself.

    Returns the integer `k * chunk_tokens + prompt_tokens`.
    """
    return k * chunk_tokens + prompt_tokens


def standard_error(rate, n):
    """Standard error of an observed success rate on n examples: sqrt(p * (1 - p) / n).

    `rate` is in [0, 1] and `n` is positive. Returns a float.
    """
    return math.sqrt(rate * (1.0 - rate) / n)


def pass_rate(outcomes):
    """Share of successful answers on the golden set.

    `outcomes` is a sequence of booleans, one per example. Returns a float in [0, 1].
    Raise ValueError when `outcomes` is empty.
    """
    outcomes = list(outcomes)
    if not outcomes:
        raise ValueError("pass rate is undefined for an empty golden set")
    return sum(1 for ok in outcomes if ok) / len(outcomes)


def regression_check(outcomes, threshold):
    """Regression test for a prompt version on a fixed golden set.

    Returns True when `pass_rate(outcomes)` is at least `threshold`, False otherwise.
    The test compares a rate with a threshold; it does not compare answer texts.
    """
    return pass_rate(outcomes) >= threshold
