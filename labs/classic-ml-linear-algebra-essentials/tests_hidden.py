"""Hidden tests: edge cases, rectangular inputs and the Eckart-Young guarantee.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def _reference_singular_values(A):
    """Square roots of the eigenvalues of A^T A, sorted in descending order."""
    G = A.T @ A
    values = np.sort(np.linalg.eigvalsh(G))[::-1]
    return np.sqrt(np.clip(values, 0.0, None))


def test_hidden_symmetric_random_eigenpairs():
    rng = np.random.default_rng(0)
    M = rng.normal(size=(2, 2))
    S = M + M.T
    values, vectors = eigen_2x2(S)
    assert_close(
        values,
        np.sort(np.linalg.eigvalsh(S))[::-1],
        atol=1e-8,
        message="eigenvalues of a random symmetric matrix, seed 0",
    )
    assert_close(
        S @ vectors,
        vectors * values,
        atol=1e-8,
        message="A v must equal lambda v, random symmetric matrix, seed 0",
    )
    assert_close(
        np.linalg.norm(vectors, axis=0),
        np.ones(2),
        atol=1e-8,
        message="eigenvectors must have unit length, seed 0",
    )


def test_hidden_negative_eigenvalue_sorted_last():
    # Sorting is by value, not by absolute value: the result must be [4, -1].
    values, _ = eigen_2x2(np.diag([-1.0, 4.0]))
    assert_close(
        values, [4.0, -1.0], atol=1e-8, message="values must be sorted in descending order"
    )


def test_hidden_singular_values_rectangular():
    rng = np.random.default_rng(1)
    A = rng.normal(size=(3, 2))
    s = singular_values(A)
    assert s.shape == (2,), f"expected 2 singular values for a 3x2 matrix, got shape {s.shape}"
    assert_close(
        s,
        _reference_singular_values(A),
        atol=1e-8,
        message="singular values of a 3x2 matrix, seed 1",
    )


def test_hidden_zero_matrix():
    A_k, error = low_rank_approx(np.zeros((3, 3)), 1)
    assert_close(
        A_k, np.zeros((3, 3)), atol=1e-12, message="approximation of zero matrix must be zero"
    )
    assert_close(error, 0.0, atol=1e-12, message="error for zero matrix must be 0")


def test_hidden_error_equals_discarded_singular_values():
    # Eckart-Young: the error equals sqrt of the sum of squares of the discarded singular values.
    rng = np.random.default_rng(2)
    A = rng.normal(size=(4, 3))
    s = _reference_singular_values(A)
    for k in (1, 2):
        A_k, error = low_rank_approx(A, k)
        expected = np.sqrt(np.sum(s[k:] ** 2))
        assert_close(
            error,
            expected,
            atol=1e-8,
            message=f"error for rank {k} must match the discarded singular values, seed 2",
        )
        assert np.linalg.matrix_rank(A_k) == k, f"A_{k} must have rank {k}, seed 2"


def test_hidden_rank_one_not_beaten_by_random_candidates():
    # No rank-1 matrix is closer to A than the truncated SVD; random candidates must not win.
    rng = np.random.default_rng(3)
    A = rng.normal(size=(4, 3))
    _, best = low_rank_approx(A, 1)
    for _ in range(200):
        u = rng.normal(size=4)
        v = rng.normal(size=3)
        candidate = np.linalg.norm(A - np.outer(u, v))
        assert best <= candidate + 1e-9, (
            "rank-1 error must not exceed a random rank-1 candidate, seed 3"
        )
