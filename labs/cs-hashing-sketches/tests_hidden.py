"""Hidden tests: scale, determinism and edge cases.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821


def test_hidden_no_false_negatives_at_scale():
    bf = BloomFilter(m=20000, k=7)
    items = [f"key-{i}" for i in range(1000)]
    for item in items:
        bf.add(item)
    assert all(item in bf for item in items), "false negative on inserted item"


def test_hidden_false_positive_rate_matches_formula():
    n, m, k = 1000, 10000, 7
    bf = BloomFilter(m=m, k=k)
    for i in range(n):
        bf.add(f"in-{i}")
    queries = 20000
    hits = sum(1 for i in range(queries) if f"out-{i}" in bf)
    rate = hits / queries
    expected = bloom_fp_formula(n, m, k)
    assert 0.5 * expected <= rate <= 1.5 * expected, (
        f"false positive rate {rate:.5f} is outside the band around the formula"
    )


def test_hidden_positions_are_deterministic():
    a = BloomFilter(m=500, k=4).positions("stable")
    b = BloomFilter(m=500, k=4).positions("stable")
    assert a == b, "positions must not depend on the instance or on PYTHONHASHSEED"


def test_hidden_formula_for_one_hash():
    f = bloom_fp_formula(n=1000, m=10000, k=1)
    assert_close(f, 0.0951626, atol=1e-6, message="mismatch for k = 1")


def test_hidden_shingles_short_text_is_empty():
    got = shingles("ab", 3)
    assert got == set(), "text shorter than the shingle size must give no shingles"


def test_hidden_jaccard_empty_sets():
    j = jaccard([], [])
    assert_close(j, 1.0, atol=1e-12, message="two empty sets must give 1.0 by convention")


def test_hidden_minhash_estimate_known_overlap():
    # A = [0, 300), B = [100, 400): intersection 200, union 400, J = 0.5.
    a = [f"x{i}" for i in range(300)]
    b = [f"x{i}" for i in range(100, 400)]
    est = estimate_jaccard(minhash_signature(a, t=256), minhash_signature(b, t=256))
    assert_close(est, 0.5, atol=0.1, message="estimate is outside the tolerance for J = 0.5")


def test_hidden_minhash_disjoint_sets_are_near_zero():
    a = [f"p{i}" for i in range(200)]
    b = [f"q{i}" for i in range(200)]
    est = estimate_jaccard(minhash_signature(a, t=256), minhash_signature(b, t=256))
    assert est <= 0.02, "disjoint sets must have an estimate close to 0"


def test_hidden_minhash_is_order_independent():
    items = [f"item{i}" for i in range(30)]
    forward = minhash_signature(items, t=40)
    backward = minhash_signature(list(reversed(items)), t=40)
    assert forward == backward, "the signature must depend on the set, not on the order"
