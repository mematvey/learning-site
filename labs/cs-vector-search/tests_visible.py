"""Visible tests. exact_knn, kmeans, build_ivf, ivf_search, recall_at_k and assert_close
come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def make_visible_data():
    rng = np.random.default_rng(1)
    db = rng.normal(size=(400, 8))
    queries = rng.normal(size=(20, 8))
    return db, queries


def test_exact_knn_hand_case():
    db = [[0.0, 0.0], [1.0, 0.0], [5.0, 5.0], [0.0, 2.0]]
    idx = np.asarray(exact_knn(db, [0.9, 0.0], 2)).tolist()
    assert idx == [1, 0], f"expected [1, 0], got {idx}"


def test_kmeans_shape():
    x = np.random.default_rng(3).normal(size=(100, 3))
    c = np.asarray(kmeans(x, 5, seed=0))
    assert c.shape == (5, 3), f"expected centroid shape (5, 3), got {c.shape}"
    assert np.all(np.isfinite(c)), "centroids must be finite"


def test_ivf_lists_partition_the_set():
    db, _ = make_visible_data()
    index = build_ivf(db, 10, seed=0)
    assert len(index["lists"]) == 10, f"expected 10 lists, got {len(index['lists'])}"
    members = sorted(int(i) for lst in index["lists"] for i in lst)
    assert members == list(range(len(db))), "every row must be in exactly one list"


def test_full_probe_is_exact():
    db, queries = make_visible_data()
    k = 5
    truth = [np.asarray(exact_knn(db, q, k)) for q in queries]
    index = build_ivf(db, 10, seed=0)
    found = [np.asarray(ivf_search(index, q, k, nprobe=10)[0]) for q in queries]
    r = recall_at_k(found, truth, k)
    assert abs(r - 1.0) < 1e-12, f"nprobe = n_lists must give recall 1, got {r:.4f}"


def test_small_nprobe_computes_fewer_distances():
    db, queries = make_visible_data()
    index = build_ivf(db, 10, seed=0)
    q = queries[0]
    _, n_small = ivf_search(index, q, 5, nprobe=1)
    _, n_full = ivf_search(index, q, 5, nprobe=10)
    assert n_small < n_full, (
        f"nprobe=1 must compute fewer distances than nprobe=10, got {n_small} vs {n_full}"
    )
    expected_full = 10 + len(db)
    assert n_full == expected_full, (
        f"full probe counts centroids and all vectors: expected {expected_full}, got {n_full}"
    )


def test_recall_at_k_hand_case():
    found = [[1, 2, 3], [4, 5, 6]]
    truth = [[1, 2, 9], [4, 5, 6]]
    r = recall_at_k(found, truth, 3)
    assert_close(r, 5 / 6, atol=1e-9, message=f"expected recall 5/6, got {r}")
