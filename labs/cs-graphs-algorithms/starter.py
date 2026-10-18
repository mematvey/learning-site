"""Graph traversal and shortest paths: starter code.

A graph is a dict (adjacency list) that maps every vertex to the list of its
neighbours. A vertex missing from the dict has no outgoing edges.

- For the BFS functions the neighbours are plain vertices: {"A": ["B", "C"]}.
- For `dijkstra` each neighbour is a pair (vertex, weight) with weight >= 0:
  {"A": [("B", 1), ("C", 4)]}.

Complete the three functions so that they match the chapter text.
"""


def bfs_order(graph, start):
    """Breadth-first visit order from `start`.

    Returns a list of the reachable vertices, `start` first. Each vertex appears
    once; neighbours are taken in the order they are listed in the adjacency list.
    """
    # TODO: keep a queue (collections.deque, from the standard library) and a set of seen vertices;
    # mark a vertex as seen when you put it in the queue.
    raise NotImplementedError


def bfs_distances(graph, start):
    """Number of edges on the shortest path from `start` to each reachable vertex.

    Returns a dict {vertex: hops}. `start` maps to 0. Unreachable vertices are absent.
    """
    # TODO: the same traversal as bfs_order, but store dist[v] = dist[u] + 1.
    raise NotImplementedError


def dijkstra(graph, start):
    """Shortest total weight from `start` to each reachable vertex (weights >= 0).

    Returns a dict {vertex: distance}. `start` maps to 0. Unreachable vertices are absent.
    """
    # TODO: keep a heap (heapq, from the standard library) of (distance, vertex) pairs and a dict of the best
    # known distances. Relax every edge of the vertex you pop. Skip stale heap entries.
    raise NotImplementedError


def topo_sort(graph):
    """Topological order of a directed graph given as an adjacency list.

    Every vertex appears once, and for each edge u -> v the vertex u comes before v.
    Vertices that only appear as neighbours are included too. If the graph has a cycle,
    raise ValueError.
    """
    # TODO: Kahn's algorithm. Count incoming edges for each vertex, put the vertices with
    # zero incoming edges in a deque, and pop them one by one; when a neighbour's count drops
    # to zero, enqueue it. If fewer vertices come out than exist, there is a cycle.
    raise NotImplementedError
