"""Eigenvectors, singular values and low-rank approximation: reference solution."""

import numpy as np


def eigen_2x2(A):
    """Eigenvalues and eigenvectors of a real square matrix with real eigenvalues.

    Returns (values, vectors). `values` is a 1-D array sorted in descending order.
    Column i of `vectors` is a unit-length eigenvector for values[i].
    """
    A = np.asarray(A, dtype=np.float64)
    values, vectors = np.linalg.eig(A)
    order = np.argsort(values)[::-1]
    return values[order].real, vectors[:, order].real


def singular_values(A):
    """Singular values of a real matrix, sorted in descending order (1-D array)."""
    A = np.asarray(A, dtype=np.float64)
    _, s, _ = np.linalg.svd(A, full_matrices=False)
    return s


def low_rank_approx(A, k):
    """Best rank-k approximation of A in the Frobenius norm.

    Returns (A_k, error), where A_k has rank k and error = ||A - A_k||_F.
    """
    A = np.asarray(A, dtype=np.float64)
    U, s, Vt = np.linalg.svd(A, full_matrices=False)
    A_k = (U[:, :k] * s[:k]) @ Vt[:k]
    error = float(np.linalg.norm(A - A_k))
    return A_k, error
