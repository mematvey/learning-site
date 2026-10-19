"""Exact search, a simplified IVF index and recall@k: starter code.

Complete the functions below. Shared conventions:

- Distance is Euclidean (L2). Vectors are rows of a 2D float array.
- Ties are broken by the smaller row index.
- An IVF index is a dict with keys "centroids" (array of shape (n_lists, d)),
  "lists" (list of n_lists integer arrays of row indices into `db`) and
  "db" (the database array).
- Distance counter: every distance computed during an IVF query counts once.
  That includes the n_lists distances from the query to the centroids and the
  distances to the vectors of the probed lists.
"""


def exact_knn(db, query, k):
    """Brute force: indices of the k nearest rows of `db` to `query`.

    db: array of shape (n, d). query: array of shape (d,).
    Returns an integer array of shape (k,), sorted from nearest to farthest.
    """
    # TODO: compute the distance from `query` to every row, then take the k smallest
    raise NotImplementedError


def kmeans(x, n_clusters, n_iter=20, seed=0):
    """Plain k-means (Lloyd's algorithm) with a fixed seed.

    Initialise the centroids with `n_clusters` distinct rows of `x`, chosen with
    np.random.default_rng(seed). Repeat `n_iter` times: assign each row to its
    nearest centroid, then move each centroid to the mean of its rows. A centroid
    with no rows keeps its previous position.
    Returns an array of shape (n_clusters, d).
    """
    # TODO: initialise centroids with the seeded generator, then alternate assign and update
    raise NotImplementedError


def build_ivf(db, n_lists, seed=0):
    """Build a simplified IVF index: k-means centroids and one list per centroid.

    Each row of `db` goes into the list of its nearest centroid.
    Returns a dict with keys "centroids", "lists" and "db" (see the module docstring).
    """
    # TODO: run kmeans on db, assign every row to its nearest centroid, collect the lists
    raise NotImplementedError


def ivf_search(index, query, k, nprobe):
    """Approximate search: probe only the `nprobe` lists whose centroids are nearest.

    nprobe is clamped to the number of lists if it is larger.
    Returns (indices, n_distances):
      indices: integer array of the k nearest candidates among the probed lists,
               sorted from nearest to farthest (fewer than k if there are not enough);
      n_distances: number of distance computations (see the module docstring).
    """
    # TODO: rank centroids, gather the rows of the nprobe best lists, rank them by distance
    raise NotImplementedError


def recall_at_k(found, truth, k):
    """Mean recall@k over queries.

    found, truth: arrays of shape (n_queries, k) (or one row of shape (k,)) with
    row indices. For each query, recall = |found[:k] & truth[:k]| / k. Returns the mean.
    """
    # TODO: count the shared indices per query, divide by k, average over queries
    raise NotImplementedError
