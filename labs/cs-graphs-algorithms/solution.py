"""Graph traversal and shortest paths: reference solution."""

import heapq
from collections import deque


def bfs_order(graph, start):
    """Breadth-first visit order from `start`.

    Returns a list of the reachable vertices, `start` first. Each vertex appears
    once; neighbours are taken in the order they are listed in the adjacency list.
    """
    order = [start]
    seen = {start}
    queue = deque([start])
    while queue:
        u = queue.popleft()
        for v in graph.get(u, []):
            if v not in seen:
                # Mark when enqueued: this also prevents cycles from looping forever.
                seen.add(v)
                order.append(v)
                queue.append(v)
    return order


def bfs_distances(graph, start):
    """Number of edges on the shortest path from `start` to each reachable vertex.

    Returns a dict {vertex: hops}. `start` maps to 0. Unreachable vertices are absent.
    """
    dist = {start: 0}
    queue = deque([start])
    while queue:
        u = queue.popleft()
        for v in graph.get(u, []):
            if v not in dist:
                dist[v] = dist[u] + 1
                queue.append(v)
    return dist


def dijkstra(graph, start):
    """Shortest total weight from `start` to each reachable vertex (weights >= 0).

    Returns a dict {vertex: distance}. `start` maps to 0. Unreachable vertices are absent.
    """
    dist = {start: 0}
    heap = [(0, start)]
    closed = set()
    while heap:
        d, u = heapq.heappop(heap)
        if u in closed:
            # Stale entry: a shorter distance to u was already found and processed.
            continue
        closed.add(u)
        for v, w in graph.get(u, []):
            candidate = d + w
            if v not in dist or candidate < dist[v]:
                dist[v] = candidate
                heapq.heappush(heap, (candidate, v))
    return dist


def topo_sort(graph):
    """Topological order of a directed graph given as an adjacency list.

    Every vertex appears once, and for each edge u -> v the vertex u comes before v.
    Vertices that only appear as neighbours are included too. If the graph has a cycle,
    raise ValueError.
    """
    vertices = []
    known = set()
    for u, neighbours in graph.items():
        for v in [u, *neighbours]:
            if v not in known:
                known.add(v)
                vertices.append(v)
    indegree = {v: 0 for v in vertices}
    for u in graph:
        for v in graph[u]:
            indegree[v] += 1
    queue = deque(v for v in vertices if indegree[v] == 0)
    order = []
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in graph.get(u, []):
            indegree[v] -= 1
            if indegree[v] == 0:
                queue.append(v)
    if len(order) != len(vertices):
        # Vertices on or behind a cycle never reach zero incoming edges.
        raise ValueError("graph has a cycle")
    return order
