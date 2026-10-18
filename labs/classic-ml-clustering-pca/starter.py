"""k-means and PCA via SVD: starter code.

Complete the six functions so that they match the chapter text. X is an
(n, d) float array, one row per object. Do not change the function names
or signatures: the tests call them directly.
"""

import numpy as np  # noqa: F401 - needed once the functions are implemented


def assign_clusters(X, centers):
    """Index of the nearest center for each row of X.

    X: (n, d) array of objects. centers: (k, d) array of centers.
    Returns an integer array of shape (n,) with values in 0..k-1.
    """
    # TODO: squared Euclidean distance from every object to every center,
    # then the index of the smallest distance for each object
    raise NotImplementedError


def update_centers(X, labels, centers):
    """Mean of the objects in each group; an empty group keeps its old center.

    Returns an array of shape (k, d), where k = centers.shape[0].
    """
    # TODO: replace each center by the mean of its group; skip empty groups
    raise NotImplementedError


def kmeans_inertia(X, centers, labels):
    """Sum of squared distances from each object to its assigned center."""
    # TODO: sum of squared distances from each row of X to centers[labels]
    raise NotImplementedError


def kmeans(X, centers, n_iter=100):
    """Run k-means from the given starting centers.

    Alternates assignment and update steps. Stops early when the assignment
    no longer changes. Returns (centers, labels).
    """
    # TODO: repeat update_centers and assign_clusters; stop when labels are stable
    raise NotImplementedError


def pca(X, n_components):
    """Principal component analysis via SVD of the centered matrix.

    Returns (Z, components, ratio):
      Z: (n, n_components) coordinates of the objects on the first axes,
      components: (n_components, d) principal axes as rows,
      ratio: explained variance ratio of every singular direction, descending.
    """
    # TODO: center X by its column means, take the SVD, and compute the
    # singular values squared divided by their sum
    raise NotImplementedError


def kmeans_pp_init(X, k, rng):
    """k-means++ starting centers: rows of X chosen one by one.

    rng: numpy.random.Generator. The first center is a uniformly random row.
    Every next center is a row drawn with probability proportional to its squared
    distance to the nearest center already chosen. Returns an array of shape (k, d).
    """
    # TODO: pick the first row uniformly with rng.integers
    # TODO: repeat: squared distance of each row to its nearest chosen center,
    # then draw the next row with rng.choice and p = distances / their sum
    raise NotImplementedError
