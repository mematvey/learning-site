"""Visible tests. `HashTable` and `bucket_index` come from the learner's file.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821


def test_bucket_index_in_range_and_stable():
    for key in ["a", "bb", 42, (1, 2), -5]:
        i = bucket_index(key, 8)
        assert 0 <= i < 8, f"bucket_index({key!r}, 8) must be in range(8), got {i}"
        assert i == bucket_index(key, 8), f"bucket_index({key!r}, 8) changed between calls"


def test_insert_and_search():
    t = HashTable()
    t.insert("a", 1)
    t.insert("b", 2)
    assert len(t) == 2, f"expected len 2 after two inserts, got {len(t)}"
    assert t.search("a") == 1, f"expected search('a') == 1, got {t.search('a')!r}"
    assert t.search("b") == 2, f"expected search('b') == 2, got {t.search('b')!r}"


def test_insert_same_key_replaces_value():
    t = HashTable()
    t.insert("x", 1)
    t.insert("x", 7)
    assert len(t) == 1, f"same key must not add a second entry, len is {len(t)}"
    assert t.search("x") == 7, f"expected the new value 7, got {t.search('x')!r}"


def test_search_missing_key_raises_key_error():
    t = HashTable()
    t.insert("a", 1)
    try:
        t.search("missing")
    except KeyError:
        return
    raise AssertionError("search of a missing key must raise KeyError")


def test_delete_removes_only_that_key():
    t = HashTable()
    t.insert("a", 1)
    t.insert("b", 2)
    t.delete("a")
    assert len(t) == 1, f"expected len 1 after delete, got {len(t)}"
    assert t.search("b") == 2, f"other keys must stay, search('b') gave {t.search('b')!r}"
    try:
        t.search("a")
    except KeyError:
        pass
    else:
        raise AssertionError("deleted key must not be found")


def test_collisions_in_one_bucket_are_kept():
    # With one bucket every key collides; the chain must keep all of them.
    t = HashTable(buckets=1)
    for i in range(3):
        t.insert(f"k{i}", i * 10)
    for i in range(3):
        got = t.search(f"k{i}")
        assert got == i * 10, f"expected search('k{i}') == {i * 10}, got {got!r}"


def test_rehash_grows_and_keeps_keys():
    t = HashTable()
    for i in range(100):
        t.insert(i, i * i)
    assert t.bucket_count > 8, f"table must grow past 8 buckets, has {t.bucket_count}"
    assert t.load_factor() <= 0.75, f"load factor must stay <= 0.75, got {t.load_factor()}"
    for i in range(100):
        got = t.search(i)
        assert got == i * i, f"after rehash expected search({i}) == {i * i}, got {got!r}"
