"""Byte pair encoding (BPE): starter code.

Complete `count_pairs` and `merge_pair`. Together with the given helpers they
learn the merges of the chapter's four-word corpus and encode new words.
A word is a tuple of symbols; the end-of-word marker "</w>" is its own symbol.
"""

END_OF_WORD = "</w>"


def initial_vocab(words):
    """Split each word into characters and append the end-of-word marker.

    words: dict mapping word -> frequency, in corpus order.
    Returns dict mapping tuple of symbols -> frequency, same key order.
    """
    vocab = {}
    for word, freq in words.items():
        vocab[tuple(word) + (END_OF_WORD,)] = freq
    return vocab


def count_pairs(vocab):
    """Count adjacent symbol pairs, weighted by word frequency.

    Keys are inserted in the order in which each pair first appears while
    scanning the vocabulary; `best_pair` relies on this order for ties.
    """
    # TODO: for every word add its frequency to each adjacent pair it contains
    raise NotImplementedError


def best_pair(counts):
    """Return the most frequent pair. On a tie, the pair seen first wins."""
    # max() returns the first maximal key, and dict keeps insertion order.
    return max(counts, key=counts.get)


def merge_pair(vocab, pair):
    """Merge every non-overlapping occurrence of `pair`, scanning left to right.

    Returns a new dict with the same key order; `vocab` is not modified.
    """
    # TODO: rebuild each word, replacing adjacent (first, second) with first + second
    raise NotImplementedError


def train_bpe(words, num_merges):
    """Learn up to `num_merges` merges. Stops early when no pair is left."""
    vocab = initial_vocab(words)
    merges = []
    for _ in range(num_merges):
        counts = count_pairs(vocab)
        if not counts:
            break
        pair = best_pair(counts)
        merges.append(pair)
        vocab = merge_pair(vocab, pair)
    return merges


def encode(word, merges):
    """Split one word into tokens by applying the merges in their learned order."""
    vocab = {tuple(word) + (END_OF_WORD,): 1}
    for pair in merges:
        vocab = merge_pair(vocab, pair)
    return list(next(iter(vocab)))
