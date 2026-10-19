"""Eigenvectors, singular values and low-rank approximation: starter code.

Complete the three functions so that they match the chapter text.
Use NumPy only. Inputs are real arrays.
"""

import numpy as np


def eigen_2x2(A):
    """Eigenvalues and eigenvectors of a real square matrix with real eigenvalues.

    Returns (values, vectors). `values` is a 1-D array sorted in descending order.
    Column i of `vectors` is a unit-length eigenvector for values[i].
    """
    A = np.asarray(A, dtype=np.float64)

    # TODO: compute the eigenpairs of A, then sort them by eigenvalue, largest first
    raise NotImplementedError


def singular_values(A):
    """Singular values of a real matrix, sorted in descending order (1-D array)."""
    A = np.asarray(A, dtype=np.float64)

    # TODO: take the singular values from a singular value decomposition of A
    raise NotImplementedError


def low_rank_approx(A, k):
    """Best rank-k approximation of A in the Frobenius norm.

    Returns (A_k, error), where A_k has rank k and error = ||A - A_k||_F.
    Use the first k singular triples of the SVD of A.
    """
    A = np.asarray(A, dtype=np.float64)

    # TODO: build A_k from the first k singular triples, then measure the Frobenius error
    raise NotImplementedError
