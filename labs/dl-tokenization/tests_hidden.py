"""Hidden tests: edge cases and tie-breaking.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821

CORPUS = {"low": 5, "lower": 2, "newest": 6, "widest": 3}


def test_hidden_merge_is_left_to_right_and_non_overlapping():
    vocab = merge_pair({("a", "a", "a"): 1}, ("a", "a"))
    assert vocab == {("aa", "a"): 1}, "mismatch on overlapping pair"


def test_hidden_merge_does_not_mutate_input():
    vocab = {("a", "b"): 1}
    merge_pair(vocab, ("a", "b"))
    assert vocab == {("a", "b"): 1}, "merge_pair modified its input"


def test_hidden_count_pairs_uses_frequency():
    counts = count_pairs({("x", "y"): 3, ("y", "x"): 2})
    assert counts == {("x", "y"): 3, ("y", "x"): 2}, "mismatch on weighted counts"


def test_hidden_tie_goes_to_first_seen_pair():
    assert train_bpe({"ab": 1, "ba": 1}, 1) == [("a", "b")], "mismatch on tie-break"


def test_hidden_zero_merges_and_empty_corpus():
    assert train_bpe(CORPUS, 0) == [], "mismatch with zero merges"
    assert train_bpe({}, 3) == [], "mismatch on empty corpus"


def test_hidden_stops_when_every_word_is_one_token():
    merges = train_bpe(CORPUS, 100)
    assert len(merges) < 100, "training must stop when no pair is left"
    for word in CORPUS:
        assert len(encode(word, merges)) == 1, "mismatch: word not reduced to one token"
