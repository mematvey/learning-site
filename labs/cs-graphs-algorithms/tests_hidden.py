"""Hidden tests: edge cases and random graphs. Not shown to the learner.

`bfs_order`, `bfs_distances` and `dijkstra` come from the runner.
"""

# ruff: noqa: F821
import random

INF = float("inf")


def _random_edges(seed, n, p, max_weight):
    """Deterministic random directed edges (u, v, w) on vertices 0..n-1."""
    rng = random.Random(seed)
    edges = []
    for u in range(n):
        for v in range(n):
            if u != v and rng.random() < p:
                edges.append((u, v, rng.randint(0, max_weight)))
    return edges


def _reference_all_pairs(n, edges):
    """Floyd-Warshall distances from vertex 0, used as the reference answer."""
    d = [[INF] * n for _ in range(n)]
    for i in range(n):
        d[i][i] = 0
    for u, v, w in edges:
        d[u][v] = min(d[u][v], w)
    for k in range(n):
        for i in range(n):
            for j in range(n):
                d[i][j] = min(d[i][j], d[i][k] + d[k][j])
    return {j: d[0][j] for j in range(n) if d[0][j] < INF}


def _to_adjacency(n, edges, weighted):
    graph = {u: [] for u in range(n)}
    for u, v, w in edges:
        graph[u].append((v, w) if weighted else v)
    return graph


def test_bfs_cycle_terminates_and_visits_each_once():
    graph = {1: [2], 2: [3], 3: [1]}
    order = bfs_order(graph, 1)
    assert order == [1, 2, 3], f"expected [1, 2, 3] on a cycle, got {order}"


def test_start_without_edges():
    assert bfs_order({"X": []}, "X") == ["X"], "isolated start must be the only vertex"
    assert bfs_distances({"X": []}, "X") == {"X": 0}, "isolated start must have distance 0"
    assert dijkstra({"X": []}, "X") == {"X": 0}, "isolated start must have distance 0"


def test_unreachable_vertices_are_absent():
    # Y is only a neighbour of an unreachable vertex; Z is a key with no way in.
    weighted = {"A": [("B", 1)], "B": [], "C": [("A", 1)], "Z": []}
    dist = dijkstra(weighted, "A")
    assert dist == {"A": 0, "B": 1}, f"expected only reachable vertices, got {dist}"
    plain = {"A": ["B"], "B": [], "C": ["A"], "Z": []}
    hops = bfs_distances(plain, "A")
    assert hops == {"A": 0, "B": 1}, f"expected only reachable vertices, got {hops}"


def test_vertex_missing_from_dict_is_a_sink():
    # "B" is never a key, so it has no outgoing edges and must not raise.
    graph = {"A": [("B", 2)]}
    dist = dijkstra(graph, "A")
    assert dist == {"A": 0, "B": 2}, f"expected {{'A': 0, 'B': 2}}, got {dist}"


def test_dijkstra_stale_entries_are_skipped():
    # B is first reached with cost 10, then improved to 3 through C.
    # The old entry (10, B) stays in the heap and must not change the answer.
    graph = {
        "A": [("B", 10), ("C", 1)],
        "C": [("B", 2), ("D", 5)],
        "B": [("D", 1)],
        "D": [],
    }
    dist = dijkstra(graph, "A")
    expected = {"A": 0, "B": 3, "C": 1, "D": 4}
    assert dist == expected, f"expected {expected}, got {dist}"


def test_dijkstra_zero_weights_allowed():
    graph = {"A": [("B", 0)], "B": [("C", 0)], "C": []}
    dist = dijkstra(graph, "A")
    assert dist == {"A": 0, "B": 0, "C": 0}, f"zero weights must be allowed, got {dist}"


def test_bfs_order_branching_tree():
    graph = {1: [2, 3], 2: [4, 5], 3: [6], 4: [], 5: [], 6: [7], 7: []}
    order = bfs_order(graph, 1)
    assert order == [1, 2, 3, 4, 5, 6, 7], f"BFS must visit by levels, got {order}"


def test_random_graphs_match_reference():
    for seed in range(5):
        n = 8
        edges = _random_edges(seed, n, 0.35, 9)
        expected = _reference_all_pairs(n, edges)
        dist = dijkstra(_to_adjacency(n, edges, True), 0)
        assert dist == expected, f"mismatch on random input, seed {seed}"


def test_random_graphs_bfs_matches_unit_weight_reference():
    for seed in range(5):
        n = 8
        edges = _random_edges(seed, n, 0.35, 9)
        unit = [(u, v, 1) for u, v, _ in edges]
        expected = _reference_all_pairs(n, unit)
        hops = bfs_distances(_to_adjacency(n, edges, False), 0)
        assert hops == expected, f"mismatch on random input, seed {seed}"
        order = bfs_order(_to_adjacency(n, edges, False), 0)
        assert sorted(order) == sorted(expected), f"order must cover reachable set, seed {seed}"


def test_topo_sort_random_dags_and_self_loop():
    rng = random.Random(7)
    for _ in range(20):
        n = 12
        graph = {u: [] for u in range(n)}
        for u in range(n):
            for v in range(u + 1, n):
                if rng.random() < 0.3:
                    graph[u].append(v)
        order = topo_sort(graph)
        assert sorted(order) == list(range(n)), f"every vertex once, got {order}"
        pos = {v: i for i, v in enumerate(order)}
        for u, nbrs in graph.items():
            for v in nbrs:
                assert pos[u] < pos[v], f"edge {u}->{v} violated in {order}"
    try:
        topo_sort({"x": ["x"]})
    except ValueError:
        return
    raise AssertionError("a self-loop is a cycle and must raise ValueError")
