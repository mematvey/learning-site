"""Exact search, a simplified IVF index and recall@k: reference solution."""

import numpy as np


def _sq_dists(points, query):
    """Squared Euclidean distances from each row of `points` to `query`."""
    diff = points - query
    return (diff * diff).sum(axis=-1)


def exact_knn(db, query, k):
    """Brute force: indices of the k nearest rows of `db` to `query`."""
    db = np.asarray(db, dtype=np.float64)
    query = np.asarray(query, dtype=np.float64)
    order = np.argsort(_sq_dists(db, query), kind="stable")
    return order[:k]


def kmeans(x, n_clusters, n_iter=20, seed=0):
    """Plain k-means (Lloyd's algorithm) with a fixed seed."""
    x = np.asarray(x, dtype=np.float64)
    rng = np.random.default_rng(seed)
    centroids = x[rng.choice(len(x), size=n_clusters, replace=False)].copy()
    for _ in range(n_iter):
        dists = ((x[:, None, :] - centroids[None, :, :]) ** 2).sum(axis=2)
        labels = dists.argmin(axis=1)
        for j in range(n_clusters):
            members = x[labels == j]
            if len(members) > 0:
                centroids[j] = members.mean(axis=0)
    return centroids


def build_ivf(db, n_lists, seed=0):
    """Build a simplified IVF index: k-means centroids and one list per centroid."""
    db = np.asarray(db, dtype=np.float64)
    centroids = kmeans(db, n_lists, seed=seed)
    dists = ((db[:, None, :] - centroids[None, :, :]) ** 2).sum(axis=2)
    labels = dists.argmin(axis=1)
    lists = [np.flatnonzero(labels == j) for j in range(n_lists)]
    return {"centroids": centroids, "lists": lists, "db": db}


def ivf_search(index, query, k, nprobe):
    """Approximate search over the `nprobe` nearest lists. Returns (indices, n_distances)."""
    centroids = index["centroids"]
    lists = index["lists"]
    db = index["db"]
    query = np.asarray(query, dtype=np.float64)
    n_lists = len(lists)
    nprobe = min(nprobe, n_lists)

    # Stage 1: distances to all centroids, keep the nprobe nearest lists.
    probe = np.argsort(_sq_dists(centroids, query), kind="stable")[:nprobe]
    # Stage 2: distances to the vectors of the probed lists only.
    parts = [np.asarray(lists[j], dtype=np.int64) for j in probe]
    candidates = np.concatenate([np.empty(0, dtype=np.int64)] + parts)
    n_distances = n_lists + len(candidates)

    order = np.argsort(_sq_dists(db[candidates], query), kind="stable")[:k]
    return candidates[order], n_distances


def recall_at_k(found, truth, k):
    """Mean recall@k over queries."""
    found = np.atleast_2d(np.asarray(found))[:, :k]
    truth = np.atleast_2d(np.asarray(truth))[:, :k]
    hits = [len(set(f.tolist()) & set(t.tolist())) / k for f, t in zip(found, truth)]
    return float(np.mean(hits))
