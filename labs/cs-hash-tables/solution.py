"""Hash table with chaining: reference solution."""

MAX_LOAD = 0.75


def bucket_index(key, m):
    """Return the bucket number for `key` in a table with `m` buckets.

    The result is always in range(m). The same key gives the same index
    in every call within one process.
    """
    return hash(key) % m


class HashTable:
    """Key-value table: each bucket holds a chain of (key, value) pairs.

    buckets: initial number of buckets.
    max_load: after an insert, if len / bucket_count exceeds this value,
    the table is rehashed into twice as many buckets.
    """

    def __init__(self, buckets=8, max_load=MAX_LOAD):
        if buckets < 1:
            raise ValueError("buckets must be at least 1")
        self.bucket_count = buckets
        self.max_load = max_load
        self._buckets = [[] for _ in range(buckets)]
        self._size = 0

    def __len__(self):
        return self._size

    def load_factor(self):
        """Return the number of keys divided by the number of buckets."""
        return self._size / self.bucket_count

    def insert(self, key, value):
        """Store `value` under `key`, replacing an existing value for the same key."""
        chain = self._buckets[bucket_index(key, self.bucket_count)]
        for i, (k, _) in enumerate(chain):
            if k == key:
                chain[i] = (key, value)
                return
        chain.append((key, value))
        self._size += 1
        if self.load_factor() > self.max_load:
            self.rehash(2 * self.bucket_count)

    def search(self, key):
        """Return the value stored under `key`; raise KeyError if it is absent."""
        chain = self._buckets[bucket_index(key, self.bucket_count)]
        for k, v in chain:
            if k == key:
                return v
        raise KeyError(key)

    def delete(self, key):
        """Remove `key` and its value; raise KeyError if it is absent."""
        chain = self._buckets[bucket_index(key, self.bucket_count)]
        for i, (k, _) in enumerate(chain):
            if k == key:
                del chain[i]
                self._size -= 1
                return
        raise KeyError(key)

    def rehash(self, new_m):
        """Move all pairs into a new table with `new_m` buckets."""
        if new_m < 1:
            raise ValueError("new_m must be at least 1")
        old_buckets = self._buckets
        self.bucket_count = new_m
        self._buckets = [[] for _ in range(new_m)]
        for chain in old_buckets:
            for k, v in chain:
                self._buckets[bucket_index(k, new_m)].append((k, v))
