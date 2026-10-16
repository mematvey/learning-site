"""Hash table with chaining: starter code.

Complete `bucket_index` and the `HashTable` methods so that they match the
chapter text. Each bucket is a chain (list) of (key, value) pairs. When the
load factor len / bucket_count grows above `max_load`, the table must be
rehashed into twice as many buckets.
"""

MAX_LOAD = 0.75


def bucket_index(key, m):
    """Return the bucket number for `key` in a table with `m` buckets.

    The result is always in range(m). Use the same function in every method.
    """
    # TODO: map the key to a bucket number in range(m), e.g. with hash()
    raise NotImplementedError


class HashTable:
    """Key-value table with separate chaining.

    buckets: initial number of buckets.
    max_load: after an insert, if len / bucket_count exceeds this value,
    the table is rehashed into twice as many buckets.
    """

    def __init__(self, buckets=8, max_load=MAX_LOAD):
        # TODO: store bucket_count, max_load, an empty list of chains and the size
        raise NotImplementedError

    def __len__(self):
        # TODO: return the number of stored keys
        raise NotImplementedError

    def load_factor(self):
        """Return the number of keys divided by the number of buckets."""
        # TODO: return len / bucket_count
        raise NotImplementedError

    def insert(self, key, value):
        """Store `value` under `key`, replacing an existing value for the same key."""
        # TODO: find the chain for the key; replace the pair if the key is there,
        # otherwise append it; then rehash to 2 * bucket_count if load_factor() > max_load
        raise NotImplementedError

    def search(self, key):
        """Return the value stored under `key`; raise KeyError if it is absent."""
        # TODO: scan only the chain of this key's bucket
        raise NotImplementedError

    def delete(self, key):
        """Remove `key` and its value; raise KeyError if it is absent."""
        # TODO: remove the pair from the chain; keep the size correct
        raise NotImplementedError

    def rehash(self, new_m):
        """Move all pairs into a new table with `new_m` buckets."""
        # TODO: create new empty chains and put every pair into its new bucket
        raise NotImplementedError
