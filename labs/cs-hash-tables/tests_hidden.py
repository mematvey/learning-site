"""Hidden tests: random operations, rehashing, deletes and errors.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import random


def _missing(t, key):
    try:
        t.search(key)
    except KeyError:
        return True
    return False


def test_hidden_random_ops_match_dict():
    rng = random.Random(0)
    t = HashTable()
    ref = {}
    for step in range(2000):
        key = rng.randrange(300)
        op = rng.random()
        if op < 0.5:
            value = rng.randrange(10**6)
            t.insert(key, value)
            ref[key] = value
        elif op < 0.75:
            if key in ref:
                t.delete(key)
                del ref[key]
            else:
                try:
                    t.delete(key)
                except KeyError:
                    pass
                else:
                    raise AssertionError("mismatch on random operations, seed 0")
        else:
            if key in ref:
                assert t.search(key) == ref[key], "mismatch on random operations, seed 0"
            else:
                assert _missing(t, key), "mismatch on random operations, seed 0"
        assert len(t) == len(ref), "mismatch on random operations, seed 0"
    for key, value in ref.items():
        assert t.search(key) == value, "mismatch after random operations, seed 0"


def test_hidden_load_factor_stays_bounded():
    t = HashTable()
    for i in range(1000):
        t.insert(f"key-{i}", i)
        assert t.load_factor() <= 0.75, "load factor exceeded 0.75 after an insert"
    assert len(t) == 1000, "all 1000 distinct keys must be stored"
    for i in range(1000):
        assert t.search(f"key-{i}") == i, "a key was lost during growth"


def test_hidden_explicit_rehash_keeps_pairs():
    t = HashTable()
    for i in range(20):
        t.insert((i, i + 1), -i)
    t.rehash(64)
    assert t.bucket_count == 64, f"expected 64 buckets after rehash, got {t.bucket_count}"
    assert len(t) == 20, "rehash must not change the number of keys"
    for i in range(20):
        assert t.search((i, i + 1)) == -i, "tuple key lost after rehash"


def test_hidden_delete_after_rehash():
    t = HashTable(buckets=2)
    for i in range(50):
        t.insert(i, i)
    t.rehash(3)
    for i in range(0, 50, 2):
        t.delete(i)
    assert len(t) == 25, "expected 25 keys left after deleting the even ones"
    for i in range(50):
        if i % 2 == 0:
            assert _missing(t, i), "deleted key is still found"
        else:
            assert t.search(i) == i, "odd key lost after deletes"


def test_hidden_delete_missing_raises_key_error():
    t = HashTable()
    t.insert("a", 1)
    try:
        t.delete("b")
    except KeyError:
        pass
    else:
        raise AssertionError("delete of a missing key must raise KeyError")
    assert len(t) == 1, "failed delete must not change the size"


def test_hidden_single_bucket_chain():
    t = HashTable(buckets=1)
    for i in range(30):
        t.insert(i, i + 100)
    for i in range(0, 30, 3):
        t.delete(i)
    for i in range(30):
        if i % 3 == 0:
            assert _missing(t, i), "deleted key is still found in one-bucket chain"
        else:
            assert t.search(i) == i + 100, "key lost in a long chain"


def test_hidden_bucket_index_range_for_many_keys():
    for m in (1, 2, 7, 64):
        for key in [-1, 0, 10**12, "", "long key " * 10, (3, "x"), 2.5]:
            i = bucket_index(key, m)
            assert isinstance(i, int) and 0 <= i < m, "bucket_index must be an int in range(m)"


def test_hidden_reinsert_after_delete():
    t = HashTable()
    t.insert("k", 1)
    t.delete("k")
    assert _missing(t, "k"), "key must be gone after delete"
    t.insert("k", 2)
    assert len(t) == 1, "re-inserted key must count once"
    assert t.search("k") == 2, "re-inserted key has the wrong value"
