"""Classical probability: starter code.

Complete the four functions. Use exact integer arithmetic (math.comb, math.factorial),
not floating-point factorials.
"""


def hypergeom_pmf(N, K, n, k):
    """P(X = k) when n objects are drawn without replacement from N, K of them marked.

    Returns 0.0 when k is impossible.
    """
    # TODO: C(K, k) * C(N - K, n - k) / C(N, n)
    raise NotImplementedError


def p_at_least_one(N, K, n):
    """Probability that a sample of n contains at least one of the K marked objects."""
    # TODO: use the complement event "no marked objects"
    raise NotImplementedError


def multiset_permutations(counts):
    """Number of distinct arrangements of objects with the given type counts.

    Example: counts [2, 2] (the word "papa") gives 6.
    """
    # TODO: n! / (n1! n2! ... nk!)
    raise NotImplementedError


def dice_sum_prob(s):
    """Probability that two fair dice sum to s."""
    # TODO: count favourable pairs among the 36 equally likely ones
    raise NotImplementedError
