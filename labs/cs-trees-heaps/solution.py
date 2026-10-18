"""Binary search tree and top-k on a heap: reference solution."""

import heapq


class Node:
    """Tree node with a key and two children (None when absent)."""

    def __init__(self, key):
        self.key = key
        self.left = None
        self.right = None


def bst_insert(root, key):
    """Insert `key` into the search tree and return the root of the tree."""
    if root is None:
        return Node(key)
    node = root
    while True:
        if key < node.key:
            if node.left is None:
                node.left = Node(key)
                break
            node = node.left
        elif key > node.key:
            if node.right is None:
                node.right = Node(key)
                break
            node = node.right
        else:
            break  # already present
    return root


def bst_search(root, key):
    """Return True if `key` is in the search tree, False otherwise."""
    node = root
    while node is not None:
        if key == node.key:
            return True
        node = node.left if key < node.key else node.right
    return False


def bst_height(root):
    """Height in edges. Empty tree: -1. Single node: 0."""
    if root is None:
        return -1
    # Walk level by level: the number of levels minus one is the height.
    level = [root]
    height = -1
    while level:
        height += 1
        level = [child for node in level for child in (node.left, node.right) if child is not None]
    return height


def top_k(values, k):
    """Return the k largest values in descending order."""
    if k <= 0:
        return []
    heap = []  # min-heap of the k largest values seen so far; heap[0] is the smallest of them
    for value in values:
        if len(heap) < k:
            heapq.heappush(heap, value)
        elif value > heap[0]:
            heapq.heapreplace(heap, value)
    return sorted(heap, reverse=True)
