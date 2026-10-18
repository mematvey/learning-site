"""Visible tests. Helpers such as `assert_close`, `BloomFilter`, `shingles` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821


def test_bloom_no_false_negatives():
    bf = BloomFilter(m=2000, k=5)
    items = [f"word{i}" for i in range(100)]
    for item in items:
        bf.add(item)
    missing = [item for item in items if item not in bf]
    assert not missing, f"added items must always be found, missing: {missing[:3]}"


def test_bloom_positions_shape_and_range():
    bf = BloomFilter(m=50, k=7)
    pos = bf.positions("hello")
    assert len(pos) == 7, f"expected 7 positions (k = 7), got {len(pos)}"
    assert all(0 <= p < 50 for p in pos), f"positions must lie in [0, 50), got {pos}"


def test_bloom_empty_filter_contains_nothing():
    bf = BloomFilter(m=100, k=3)
    assert "anything" not in bf, "an empty filter must answer 'no' for every item"


def test_bloom_fp_formula_example():
    # Chapter example: m/n = 10 bits per item and k = 7 give f of about 0.0082.
    f = bloom_fp_formula(n=1000, m=10000, k=7)
    assert_close(f, 0.0082, atol=1e-4, message=f"expected about 0.0082 for m/n=10, k=7, got {f}")


def test_shingles_example():
    got = shingles("abcd", 2)
    assert got == {"ab", "bc", "cd"}, f"expected {{'ab', 'bc', 'cd'}}, got {got}"


def test_jaccard_example():
    # {a, b, c, d} and {c, d, e, f}: intersection 2, union 6.
    j = jaccard(["a", "b", "c", "d"], ["c", "d", "e", "f"])
    assert_close(j, 1 / 3, atol=1e-9, message=f"expected 1/3, got {j}")


def test_minhash_identical_sets_have_estimate_one():
    sig = minhash_signature(["x", "y", "z"], t=50)
    assert len(sig) == 50, f"expected signature of length 50, got {len(sig)}"
    est = estimate_jaccard(sig, minhash_signature(["z", "y", "x"], t=50))
    assert est == 1.0, f"identical sets must give estimate 1.0, got {est}"


def test_minhash_estimate_close_to_jaccard():
    a = ["a", "b", "c", "d"]
    b = ["c", "d", "e", "f"]
    est = estimate_jaccard(minhash_signature(a, t=200), minhash_signature(b, t=200))
    assert_close(est, 1 / 3, atol=0.1, message=f"estimate {est:.3f} is too far from 1/3")
