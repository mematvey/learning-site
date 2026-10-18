"""RAG retrieval metrics and a prompt regression check: starter code.

Complete the five functions so that they match the chapter text. The chapter uses
recall@k over a ranked list of retrieved chunks, a token estimate for the input
`k * chunk_tokens + prompt_tokens`, and a pass-rate threshold on a fixed golden set.
Only the standard library is used: no model calls, no network.
"""


def recall_at_k(ranked_ids, relevant_ids, k):
    """Recall@k: share of relevant chunks found in the first k retrieved ones.

    `ranked_ids` is the retrieved list in rank order, `relevant_ids` the set of
    relevant chunk ids. Returns |top-k & relevant| / |relevant| as a float in [0, 1].
    If `k` exceeds the length of `ranked_ids`, all retrieved chunks are used.
    Raise ValueError when `relevant_ids` is empty.
    """
    # TODO: take the first k ids of the ranking and count how many are relevant
    # TODO: divide by the total number of relevant chunks
    raise NotImplementedError


def input_tokens(k, chunk_tokens, prompt_tokens):
    """Approximate input size in tokens: k retrieved chunks plus the prompt itself.

    Returns the integer `k * chunk_tokens + prompt_tokens`.
    """
    # TODO: return the approximate input size
    raise NotImplementedError


def standard_error(rate, n):
    """Standard error of an observed success rate on n examples: sqrt(p * (1 - p) / n).

    `rate` is in [0, 1] and `n` is positive. Returns a float.
    """
    # TODO: return sqrt(rate * (1 - rate) / n)
    raise NotImplementedError


def pass_rate(outcomes):
    """Share of successful answers on the golden set.

    `outcomes` is a sequence of booleans, one per example. Returns a float in [0, 1].
    Raise ValueError when `outcomes` is empty.
    """
    # TODO: count the successes and divide by the number of examples
    raise NotImplementedError


def regression_check(outcomes, threshold):
    """Regression test for a prompt version on a fixed golden set.

    Returns True when `pass_rate(outcomes)` is at least `threshold`, False otherwise.
    The test compares a rate with a threshold; it does not compare answer texts.
    """
    # TODO: compare the pass rate with the threshold
    raise NotImplementedError
