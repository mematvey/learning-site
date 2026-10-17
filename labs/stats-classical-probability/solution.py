"""Classical probability: reference solution."""

import math


def hypergeom_pmf(N, K, n, k):
    if k < 0 or k > n or k > K or n - k > N - K:
        return 0.0
    return math.comb(K, k) * math.comb(N - K, n - k) / math.comb(N, n)


def p_at_least_one(N, K, n):
    return 1.0 - math.comb(N - K, n) / math.comb(N, n)


def multiset_permutations(counts):
    result = math.factorial(sum(counts))
    for c in counts:
        result //= math.factorial(c)
    return result


def dice_sum_prob(s):
    favourable = sum(1 for a in range(1, 7) for b in range(1, 7) if a + b == s)
    return favourable / 36
