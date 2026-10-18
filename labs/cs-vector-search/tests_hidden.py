"""Hidden tests: edge cases and invariants. Same runner namespace as tests_visible.py."""

# ruff: noqa: F821
import numpy as np


def hidden_data():
    rng = np.random.default_rng(11)
    db = rng.normal(size=(300, 6))
    queries = rng.normal(size=(15, 6))
    return db, queries


def test_exact_knn_finds_identical_row():
    db, _ = hidden_data()
    idx = np.asarray(exact_knn(db, db[17], 1)).tolist()
    assert idx == [17], f"query equal to row 17 must return [17], got {idx}"


def test_kmeans_one_cluster_is_mean():
    x = np.random.default_rng(5).normal(size=(50, 4))
    c = np.asarray(kmeans(x, 1, seed=0))
    assert_close(c[0], x.mean(axis=0), atol=1e-9, message="one centroid must be the data mean")


def test_kmeans_is_deterministic():
    x = np.random.default_rng(6).normal(size=(80, 3))
    a = np.asarray(kmeans(x, 4, seed=7))
    b = np.asarray(kmeans(x, 4, seed=7))
    assert_close(a, b, atol=0.0, message="same seed must give the same centroids")


def test_full_probe_exact_for_k_one_and_several_seeds():
    db, queries = hidden_data()
    for seed in (0, 1, 2):
        index = build_ivf(db, 8, seed=seed)
        for k in (1, 4):
            truth = [np.asarray(exact_knn(db, q, k)) for q in queries]
            found = [np.asarray(ivf_search(index, q, k, nprobe=8)[0]) for q in queries]
            r = recall_at_k(found, truth, k)
            assert abs(r - 1.0) < 1e-12, f"seed {seed}, k {k}: full probe recall {r:.4f} != 1"


def test_recall_grows_with_nprobe():
    db, queries = hidden_data()
    k = 5
    truth = [np.asarray(exact_knn(db, q, k)) for q in queries]
    index = build_ivf(db, 10, seed=0)
    previous = -1.0
    for nprobe in (1, 2, 4, 10):
        found = [np.asarray(ivf_search(index, q, k, nprobe=nprobe)[0]) for q in queries]
        r = recall_at_k(found, truth, k)
        assert r + 1e-12 >= previous, (
            f"recall must not drop when nprobe grows: nprobe={nprobe} gave {r:.4f} "
            f"after {previous:.4f}"
        )
        previous = r


def test_nprobe_above_list_count_is_clamped():
    db, queries = hidden_data()
    index = build_ivf(db, 10, seed=0)
    q = queries[3]
    idx_a, n_a = ivf_search(index, q, 5, nprobe=10)
    idx_b, n_b = ivf_search(index, q, 5, nprobe=50)
    assert np.asarray(idx_a).tolist() == np.asarray(idx_b).tolist(), (
        "nprobe above n_lists must give the same result as nprobe = n_lists"
    )
    assert n_a == n_b, f"distance counts differ after clamping: {n_a} vs {n_b}"


def test_result_indices_are_valid():
    db, queries = hidden_data()
    index = build_ivf(db, 10, seed=0)
    idx = np.asarray(ivf_search(index, queries[0], 5, nprobe=3)[0]).tolist()
    assert len(idx) == 5, f"expected 5 indices, got {len(idx)}"
    assert len(set(idx)) == 5, f"indices must be unique, got {idx}"
    assert all(0 <= i < len(db) for i in idx), f"indices out of range: {idx}"
