"""Visible tests. `bfs_order`, `bfs_distances` and `dijkstra` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821


def test_bfs_order_small_graph():
    graph = {"A": ["B", "C"], "B": ["D"], "C": [], "D": []}
    order = bfs_order(graph, "A")
    expected = ["A", "B", "C", "D"]
    assert order == expected, f"expected {expected}, got {order}"


def test_bfs_distances_count_edges():
    graph = {1: [2, 3], 2: [4], 3: [4], 4: [5], 5: []}
    dist = bfs_distances(graph, 1)
    expected = {1: 0, 2: 1, 3: 1, 4: 2, 5: 3}
    assert dist == expected, f"expected {expected}, got {dist}"


def test_dijkstra_weighted_graph():
    # Via B and C the cost is 1 + 2 + 3 = 6, while the direct route to D has 2 hops and cost 7.
    graph = {
        "A": [("B", 1), ("C", 4)],
        "B": [("C", 2), ("D", 6)],
        "C": [("D", 3)],
        "D": [],
    }
    dist = dijkstra(graph, "A")
    expected = {"A": 0, "B": 1, "C": 3, "D": 6}
    assert dist == expected, f"expected {expected}, got {dist}"


def test_dijkstra_hand_case_with_longer_route():
    # The cheapest route to C goes through B, not the direct edge of weight 6.
    graph = {"S": [("A", 2), ("C", 6)], "A": [("B", 2)], "B": [("C", 1)], "C": []}
    dist = dijkstra(graph, "S")
    expected = {"S": 0, "A": 2, "B": 4, "C": 5}
    assert dist == expected, f"expected {expected}, got {dist}"


def test_topo_sort_pipeline_respects_edges():
    # A small DAG pipeline: fetch -> clean -> (train, report); train -> deploy.
    graph = {
        "fetch": ["clean"],
        "clean": ["train", "report"],
        "train": ["deploy"],
        "report": [],
        "deploy": [],
    }
    order = topo_sort(graph)
    assert sorted(order) == sorted(graph), f"every vertex once, got {order}"
    pos = {v: i for i, v in enumerate(order)}
    for u, nbrs in graph.items():
        for v in nbrs:
            assert pos[u] < pos[v], f"{u} must come before {v} in {order}"


def test_topo_sort_adds_vertices_seen_only_as_neighbours():
    order = topo_sort({"a": ["b"]})
    assert order == ["a", "b"], f"expected ['a', 'b'], got {order}"


def test_topo_sort_cycle_raises_value_error():
    graph = {1: [2], 2: [3], 3: [1], 4: []}
    try:
        topo_sort(graph)
    except ValueError:
        return
    raise AssertionError("a cycle must raise ValueError")
