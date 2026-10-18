"""Visible tests. `initial_vocab`, `count_pairs`, `merge_pair`, `train_bpe` and `encode` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821

CORPUS = {"low": 5, "lower": 2, "newest": 6, "widest": 3}
CHAPTER_MERGES = [("e", "s"), ("es", "t"), ("est", "</w>"), ("l", "o"), ("lo", "w")]


def test_initial_vocab_adds_end_marker():
    vocab = initial_vocab({"low": 5})
    expected = {("l", "o", "w", "</w>"): 5}
    assert vocab == expected, f"expected {expected}, got {vocab}"


def test_count_pairs_weighted_by_frequency():
    counts = count_pairs(initial_vocab(CORPUS))
    # e+s is in newest (6) and widest (3); t+</w> is in the same two words.
    assert counts.get(("e", "s")) == 9, (
        f"expected count 9 for ('e', 's'), got {counts.get(('e', 's'))}"
    )
    assert counts.get(("t", "</w>")) == 9, (
        f"expected count 9 for ('t', '</w>'), got {counts.get(('t', '</w>'))}"
    )
    assert counts.get(("l", "o")) == 7, (
        f"expected count 7 for ('l', 'o'), got {counts.get(('l', 'o'))}"
    )


def test_merge_pair_small_hand_case():
    vocab = merge_pair({("a", "a", "b"): 1}, ("a", "a"))
    expected = {("aa", "b"): 1}
    assert vocab == expected, f"expected {expected}, got {vocab}"


def test_first_merge_is_most_frequent_pair():
    merges = train_bpe(CORPUS, 1)
    assert merges == [("e", "s")], f"expected first merge [('e', 's')], got {merges}"


def test_five_merges_match_chapter():
    merges = train_bpe(CORPUS, 5)
    assert merges == CHAPTER_MERGES, f"expected {CHAPTER_MERGES}, got {merges}"


def test_encode_matches_chapter_example():
    merges = train_bpe(CORPUS, 5)
    cases = {
        "newest": ["n", "e", "w", "est</w>"],
        "lower": ["low", "e", "r", "</w>"],
        "widest": ["w", "i", "d", "est</w>"],
    }
    for word, expected in cases.items():
        got = encode(word, merges)
        assert got == expected, f"encode({word!r}): expected {expected}, got {got}"
