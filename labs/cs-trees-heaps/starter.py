"""Binary search tree and top-k on a heap: starter code.

Complete the functions below. The tree is not balanced on purpose: keys
inserted in sorted order form a chain, and the tests check that case too.

A tree is either None (empty) or a Node. Node has `key`, `left` and `right`;
a missing child is None.
"""


class Node:
    """Tree node with a key and two children (None when absent)."""

    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None


def bst_insert(root, key):
    """Insert `key` into the search tree and return the root of the tree.

    `root` may be None (empty tree). Keys smaller than a node's key go to the
    left subtree, larger ones to the right. A key already in the tree is ignored.
    Use a loop, not recursion: sorted input makes the tree as deep as the number of keys.
    """
    # TODO: walk from `root` to the empty place for `key` and attach a new Node there
    raise NotImplementedError


def bst_search(root, key):
    """Return True if `key` is in the search tree, False otherwise.

    Follow one path from the root: at each node go left or right, or stop on a match.
    """
    # TODO: walk down from `root` using the same left/right rule as bst_insert
    raise NotImplementedError


def bst_height(root):
    """Height of the tree in edges: the number of edges on its longest root-to-leaf path.

    An empty tree has height -1, a single node has height 0.
    A chain of 7 nodes has height 6. Use a loop, not recursion.
    """
    # TODO: count levels from the root down (a level is a list of nodes), then subtract 1
    raise NotImplementedError


def top_k(values, k):
    """Return the k largest values in descending order.

    `values` is any iterable of numbers, possibly with duplicates. If k <= 0,
    return []. If k is larger than the input, return all values sorted descending.
    Keep a min-heap of at most k candidates (the `heapq` module) instead of sorting everything.
    """
    # TODO: keep the k largest values seen so far in a heap and return them sorted descending
    raise NotImplementedError
