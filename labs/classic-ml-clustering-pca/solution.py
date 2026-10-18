"""k-means and PCA via SVD: reference solution."""

import numpy as np


def assign_clusters(X, centers):
    """Index of the nearest center for each row of X.

    X: (n, d) array of objects. centers: (k, d) array of centers.
    Returns an integer array of shape (n,) with values in 0..k-1.
    """
    X = np.asarray(X, dtype=np.float64)
    centers = np.asarray(centers, dtype=np.float64)
    diff = X[:, None, :] - centers[None, :, :]
    dist2 = np.sum(diff**2, axis=-1)
    return np.argmin(dist2, axis=1)


def update_centers(X, labels, centers):
    """Mean of the objects in each group; an empty group keeps its old center.

    Returns an array of shape (k, d), where k = centers.shape[0].
    """
    X = np.asarray(X, dtype=np.float64)
    labels = np.asarray(labels)
    centers = np.asarray(centers, dtype=np.float64)
    new_centers = centers.copy()
    for j in range(centers.shape[0]):
        members = X[labels == j]
        if len(members) > 0:
            new_centers[j] = members.mean(axis=0)
    return new_centers


def kmeans_inertia(X, centers, labels):
    """Sum of squared distances from each object to its assigned center."""
    X = np.asarray(X, dtype=np.float64)
    centers = np.asarray(centers, dtype=np.float64)
    labels = np.asarray(labels)
    diff = X - centers[labels]
    return float(np.sum(diff**2))


def kmeans(X, centers, n_iter=100):
    """Run k-means from the given starting centers.

    Alternates assignment and update steps. Stops early when the assignment
    no longer changes. Returns (centers, labels).
    """
    X = np.asarray(X, dtype=np.float64)
    centers = np.asarray(centers, dtype=np.float64).copy()
    labels = assign_clusters(X, centers)
    for _ in range(n_iter):
        centers = update_centers(X, labels, centers)
        new_labels = assign_clusters(X, centers)
        if np.array_equal(new_labels, labels):
            break
        labels = new_labels
    return centers, labels


def pca(X, n_components):
    """Principal component analysis via SVD of the centered matrix.

    Returns (Z, components, ratio):
      Z: (n, n_components) coordinates of the objects on the first axes,
      components: (n_components, d) principal axes as rows,
      ratio: explained variance ratio of every singular direction, descending.
    """
    X = np.asarray(X, dtype=np.float64)
    Xc = X - X.mean(axis=0)
    _, s, Vt = np.linalg.svd(Xc, full_matrices=False)
    ratio = s**2 / np.sum(s**2)
    components = Vt[:n_components]
    Z = Xc @ components.T
    return Z, components, ratio


def kmeans_pp_init(X, k, rng):
    """k-means++ starting centers: rows of X chosen one by one.

    rng: numpy.random.Generator. The first center is a uniformly random row.
    Every next center is a row drawn with probability proportional to its squared
    distance to the nearest center already chosen. Returns an array of shape (k, d).
    """
    X = np.asarray(X, dtype=np.float64)
    n = X.shape[0]
    if not 1 <= k <= n:
        raise ValueError("k must be between 1 and the number of objects")
    chosen = [int(rng.integers(n))]
    for _ in range(k - 1):
        d2 = np.min(np.sum((X[:, None, :] - X[chosen][None, :, :]) ** 2, axis=-1), axis=1)
        total = d2.sum()
        probs = d2 / total if total > 0 else np.full(n, 1.0 / n)
        chosen.append(int(rng.choice(n, p=probs)))
    return X[chosen].copy()
