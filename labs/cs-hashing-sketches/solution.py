"""Reference solution: Bloom filter and MinHash. Not shown to the reader."""

import hashlib
import math


def stable_hash(item, seed):
    """Deterministic 64-bit hash of `item`, with `seed` as the salt."""
    data = f"{seed}\x1f{item}".encode()
    return int.from_bytes(hashlib.sha256(data).digest()[:8], "big")


class BloomFilter:
    """Bit array of size m with k hash functions derived from one hash by salts."""

    def __init__(self, m, k):
        self.m = m
        self.k = k
        self.bits = [False] * m

    def positions(self, item):
        return [stable_hash(item, seed) % self.m for seed in range(self.k)]

    def add(self, item):
        for pos in self.positions(item):
            self.bits[pos] = True

    def __contains__(self, item):
        return all(self.bits[pos] for pos in self.positions(item))


def bloom_fp_formula(n, m, k):
    """Expected false positive rate f = (1 - exp(-k n / m))**k."""
    p_zero = math.exp(-k * n / m)
    return (1.0 - p_zero) ** k


def shingles(text, size):
    """Set of character shingles of length `size`."""
    return {text[i : i + size] for i in range(len(text) - size + 1)}


def jaccard(a, b):
    """Exact Jaccard index |A & B| / |A | B| for two sets."""
    a, b = set(a), set(b)
    union = a | b
    if not union:
        return 1.0
    return len(a & b) / len(union)


def minhash_signature(items, t):
    """For each of t salts, keep the smallest hash over the set's items."""
    return [min(stable_hash(x, seed) for x in items) for seed in range(t)]


def estimate_jaccard(sig_a, sig_b):
    """Fraction of equal positions in two MinHash signatures."""
    matches = sum(1 for x, y in zip(sig_a, sig_b) if x == y)
    return matches / len(sig_a)
