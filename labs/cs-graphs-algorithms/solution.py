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
