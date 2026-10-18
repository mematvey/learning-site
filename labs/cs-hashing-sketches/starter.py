"""Bloom filter and MinHash: starter code.

Complete the functions and the class methods marked with TODO.
Use only the standard library. `stable_hash` is provided: it is deterministic
across runs, so do not replace it with the built-in `hash`.
"""

import hashlib


def stable_hash(item, seed):
    """Deterministic 64-bit hash of `item`, with `seed` as the salt. Provided."""
    data = f"{seed}\x1f{item}".encode()
    return int.from_bytes(hashlib.sha256(data).digest()[:8], "big")


class BloomFilter:
    """Bit array of size `m` with `k` hash functions taken from one hash by salts."""

    def __init__(self, m, k):
        """Create an empty filter with `m` bits and `k` hash functions."""
        # TODO: store m and k, and create a list of m False values as the bit array
        raise NotImplementedError

    def positions(self, item):
        """Return the k bit positions of `item`, one per salt 0..k-1, each in [0, m)."""
        # TODO: use stable_hash(item, seed) for seed in range(k), then reduce it modulo m
        raise NotImplementedError

    def add(self, item):
        """Set all k bits of `item` to True."""
        # TODO: set every position returned by self.positions(item)
        raise NotImplementedError

    def __contains__(self, item):
        """Return False only if `item` was never added. True may be a false positive."""
        # TODO: return True only if every position of `item` is set
        raise NotImplementedError


def bloom_fp_formula(n, m, k):
    """Expected false positive rate for n items, m bits and k hash functions.

    Use f = (1 - exp(-k * n / m)) ** k, with math.exp.
    """
    # TODO: return the formula value as a float
    raise NotImplementedError


def shingles(text, size):
    """Return the set of character shingles of length `size` in `text`.

    A shingle is a substring of `size` consecutive characters.
    """
    # TODO: collect text[i : i + size] for every valid start i
    raise NotImplementedError


def jaccard(a, b):
    """Exact Jaccard index |A & B| / |A | B| of two collections.

    Two empty sets give 1.0 here.
    """
    # TODO: convert both to sets and divide the size of the intersection by the size of the union
    raise NotImplementedError


def minhash_signature(items, t):
    """Return a list of t values: for each salt 0..t-1, the smallest stable_hash over `items`."""
    # TODO: for each seed in range(t), take min(stable_hash(x, seed) for x in items)
    raise NotImplementedError


def estimate_jaccard(sig_a, sig_b):
    """Estimate the Jaccard index as the fraction of equal positions of two signatures."""
    # TODO: count positions where the two signatures are equal, divide by the length
    raise NotImplementedError
