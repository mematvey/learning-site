"""Visible tests. `assign_clusters`, `update_centers`, `kmeans_inertia`, `kmeans`,
`pca` and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np

# Four objects forming two vertical pairs, left at x=0 and right at x=4.
X_PAIRS = np.array([[0.0, 0.0], [0.0, 2.0], [4.0, 0.0], [4.0, 2.0]])


def test_assign_nearest_center():
    labels = assign_clusters(X_PAIRS, [[0.0, 1.0], [4.0, 1.0]])
    expected = [0, 0, 1, 1]
    assert np.shape(labels) == (4,), f"expected shape (4,), got {np.shape(labels)}"
    assert_close(labels, expected, atol=0, rtol=0, message=f"expected {expected}, got {labels}")


def test_update_centers_are_group_means():
    centers = update_centers(X_PAIRS, [0, 0, 1, 1], [[1.0, 0.0], [3.0, 2.0]])
    expected = [[0.0, 1.0], [4.0, 1.0]]
    assert_close(
        centers,
        expected,
        atol=1e-6,
        message=f"expected group means {expected}, got {np.round(centers, 6).tolist()}",
    )


def test_inertia_hand_case():
    # Each object is 1.0 away from its center: 4 objects, squared distance 1 each.
    value = kmeans_inertia(X_PAIRS, [[0.0, 1.0], [4.0, 1.0]], [0, 0, 1, 1])
    assert_close(value, 4.0, atol=1e-6, message=f"expected inertia 4.0, got {value}")


def test_kmeans_two_pairs():
    centers, labels = kmeans(X_PAIRS, [[1.0, 0.0], [3.0, 2.0]])
    assert_close(
        labels, [0, 0, 1, 1], atol=0, rtol=0, message=f"expected labels [0, 0, 1, 1], got {labels}"
    )
    assert_close(
        centers,
        [[0.0, 1.0], [4.0, 1.0]],
        atol=1e-6,
        message=f"expected centers [[0, 1], [4, 1]], got {np.round(centers, 6).tolist()}",
    )


def test_pca_hand_case():
    # Points lie on the x-axis with variance 2 and on the y-axis with variance 0.5.
    X = np.array([[1.0, 0.0], [-1.0, 0.0], [0.0, 0.5], [0.0, -0.5]])
    Z, components, ratio = pca(X, 1)
    assert np.shape(Z) == (4, 1), f"expected Z shape (4, 1), got {np.shape(Z)}"
    assert np.shape(components) == (1, 2), (
        f"expected components shape (1, 2), got {np.shape(components)}"
    )
    assert_close(ratio, [0.8, 0.2], atol=1e-6, message=f"expected ratio [0.8, 0.2], got {ratio}")
    # The first axis is the x-axis; the sign of an SVD axis is arbitrary.
    assert_close(
        np.abs(components[0]), [1.0, 0.0], atol=1e-6, message="first principal axis must be along x"
    )


def test_kmeans_pp_init_takes_one_center_from_each_far_group():
    # Two tight groups far apart: the D^2 rule almost surely picks one row from each.
    X = np.array([[0.0, 0.0], [0.1, 0.0], [0.0, 0.1], [50.0, 50.0], [50.1, 50.0], [50.0, 50.1]])
    for seed in range(5):
        centers = kmeans_pp_init(X, 2, np.random.default_rng(seed))
        assert centers.shape == (2, 2), f"expected shape (2, 2), got {centers.shape}"
        assert (centers[:, 0] > 25).sum() == 1, f"seed {seed}: one center per group expected"
