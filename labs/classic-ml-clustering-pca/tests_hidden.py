"""Hidden tests: edge cases, invariances and consistency of the two methods.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def _blobs(seed):
    """Three well separated blobs of 30 points each, fixed seed."""
    rng = np.random.default_rng(seed)
    true_centers = np.array([[0.0, 0.0], [5.0, 5.0], [0.0, 6.0]])
    X = np.vstack([c + 0.3 * rng.normal(size=(30, 2)) for c in true_centers])
    return X, true_centers


def _reference_assign(X, centers):
    labels = []
    for x in np.asarray(X, dtype=float).tolist():
        d = [sum((a - b) ** 2 for a, b in zip(x, c)) for c in np.asarray(centers).tolist()]
        labels.append(d.index(min(d)))
    return np.array(labels)


def test_hidden_assign_matches_bruteforce():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(50, 3))
    centers = rng.normal(size=(4, 3))
    labels = assign_clusters(X, centers)
    assert_close(
        labels,
        _reference_assign(X, centers),
        atol=0,
        rtol=0,
        message="mismatch on random input, seed 0",
    )


def test_hidden_update_keeps_empty_group_center():
    X = np.array([[0.0, 0.0], [2.0, 0.0]])
    centers = update_centers(X, [0, 0], [[9.0, 9.0], [7.0, 7.0]])
    assert_close(
        centers,
        [[1.0, 0.0], [7.0, 7.0]],
        atol=1e-6,
        message="empty group must keep its previous center",
    )


def test_hidden_inertia_is_non_increasing():
    X, _ = _blobs(1)
    init = np.array([[1.0, 1.0], [4.0, 4.0], [1.0, 5.0]])
    previous = np.inf
    for n_iter in range(7):
        centers, labels = kmeans(X, init, n_iter=n_iter)
        value = kmeans_inertia(X, centers, labels)
        assert value <= previous + 1e-9, f"inertia increased at n_iter={n_iter}"
        previous = value


def test_hidden_kmeans_recovers_blobs():
    X, true_centers = _blobs(2)
    init = np.array([[1.0, 1.0], [4.0, 4.0], [1.0, 5.0]])
    centers, _ = kmeans(X, init)
    for c in true_centers:
        nearest = np.min(np.linalg.norm(centers - c, axis=1))
        assert nearest < 0.3, "a true blob has no nearby center after k-means"


def test_hidden_kmeans_fixed_point():
    X, _ = _blobs(3)
    init = np.array([[1.0, 1.0], [4.0, 4.0], [1.0, 5.0]])
    centers, labels = kmeans(X, init)
    assert_close(
        labels,
        assign_clusters(X, centers),
        atol=0,
        rtol=0,
        message="labels must be the nearest centers at the end",
    )
    assert_close(
        centers,
        update_centers(X, labels, centers),
        atol=1e-9,
        message="centers must be the means of their groups at the end",
    )


def test_hidden_pca_orthonormal_and_uncorrelated():
    rng = np.random.default_rng(4)
    X = rng.normal(size=(60, 5)) @ rng.normal(size=(5, 5))
    Z, components, ratio = pca(X, 5)
    assert_close(
        components @ components.T,
        np.eye(5),
        atol=1e-8,
        message="principal axes must be orthonormal",
    )
    cov = Z.T @ Z
    off_diag = cov - np.diag(np.diag(cov))
    assert_close(
        off_diag,
        np.zeros((5, 5)),
        atol=1e-8,
        message="coordinates on different axes must be uncorrelated",
    )
    assert_close(Z.mean(axis=0), np.zeros(5), atol=1e-8, message="coordinates must be centered")
    assert_close(ratio.sum(), 1.0, atol=1e-9, message="ratio must sum to 1")
    assert np.all(np.diff(ratio) <= 1e-12), "ratio must be in descending order"


def test_hidden_pca_matches_eigendecomposition():
    rng = np.random.default_rng(5)
    X = rng.normal(size=(80, 4)) * np.array([3.0, 2.0, 1.0, 0.5])
    Xc = X - X.mean(axis=0)
    eigvals, eigvecs = np.linalg.eigh(Xc.T @ Xc)
    order = np.argsort(eigvals)[::-1]
    eigvals, eigvecs = eigvals[order], eigvecs[:, order]
    _, components, ratio = pca(X, 2)
    assert_close(
        ratio,
        eigvals / eigvals.sum(),
        atol=1e-8,
        message="ratio must equal eigenvalue shares of the covariance",
    )
    # Axes are defined up to sign, so compare absolute values.
    assert_close(
        np.abs(components),
        np.abs(eigvecs[:, :2].T),
        atol=1e-6,
        message="principal axes must match covariance eigenvectors up to sign",
    )


def test_hidden_pca_is_shift_invariant():
    rng = np.random.default_rng(6)
    X = rng.normal(size=(40, 3))
    _, _, ratio = pca(X, 3)
    _, _, ratio_shifted = pca(X + 1000.0, 3)
    assert_close(
        ratio_shifted,
        ratio,
        atol=1e-8,
        message="adding a constant to all objects must not change the ratio",
    )


def test_hidden_pca_one_dimension():
    rng = np.random.default_rng(7)
    X = rng.normal(size=(10, 1)) * 2.0
    Z, _components, ratio = pca(X, 1)
    assert np.shape(Z) == (10, 1), f"expected Z shape (10, 1), got {np.shape(Z)}"
    assert_close(ratio, [1.0], atol=1e-9, message="one feature must explain all variance")


def test_hidden_inputs_not_mutated():
    rng = np.random.default_rng(8)
    X = rng.normal(size=(20, 2))
    centers = np.array([[0.0, 0.0], [1.0, 1.0]])
    X_copy, centers_copy = X.copy(), centers.copy()
    kmeans(X, centers)
    pca(X, 2)
    assert np.array_equal(X, X_copy), "input X must not be modified"
    assert np.array_equal(centers, centers_copy), "starting centers must not be modified"


def test_kmeans_pp_init_rows_are_data_points_and_distinct():
    rng = np.random.default_rng(11)
    X = rng.normal(size=(30, 3))
    centers = kmeans_pp_init(X, 4, np.random.default_rng(5))
    assert centers.shape == (4, 3)
    for c in centers:
        assert np.any(np.all(np.isclose(X, c), axis=1))
    assert len({tuple(np.round(c, 9)) for c in centers}) == 4
