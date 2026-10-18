"""Visible tests. `eigen_2x2`, `singular_values`, `low_rank_approx` and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def test_eigenvalues_of_symmetric_2x2():
    # [[2, 1], [1, 2]]: lambda^2 - 4 lambda + 3 = 0, so the eigenvalues are 3 and 1.
    values, _ = eigen_2x2([[2.0, 1.0], [1.0, 2.0]])
    assert_close(values, [3.0, 1.0], atol=1e-8, message=f"expected [3, 1], got {values.tolist()}")


def test_eigenvectors_satisfy_definition():
    # A v = lambda v must hold for every returned pair.
    A = np.array([[2.0, 1.0], [1.0, 2.0]])
    values, vectors = eigen_2x2(A)
    assert vectors.shape == (2, 2), f"expected eigenvector matrix (2, 2), got {vectors.shape}"
    for i in range(2):
        v = vectors[:, i]
        assert_close(
            A @ v, values[i] * v, atol=1e-8, message=f"A v must equal lambda v for pair {i}"
        )


def test_singular_values_of_shear():
    # [[1, 1], [0, 1]]: the singular values are phi and 1/phi, phi = (1 + sqrt 5) / 2.
    s = singular_values([[1.0, 1.0], [0.0, 1.0]])
    expected = [1.618034, 0.618034]
    assert_close(s, expected, atol=1e-6, message=f"expected {expected}, got {s.tolist()}")


def test_rank_one_error_is_second_singular_value():
    # Keeping one singular triple leaves an error equal to the second singular value, about 0.618.
    A = np.array([[1.0, 1.0], [0.0, 1.0]])
    A1, error = low_rank_approx(A, 1)
    assert np.linalg.matrix_rank(A1) == 1, "A_1 must have rank 1"
    assert_close(error, 0.618034, atol=1e-6, message=f"expected error about 0.618, got {error}")


def test_full_rank_approximation_is_exact():
    A = np.array([[1.0, 1.0], [0.0, 1.0]])
    A2, error = low_rank_approx(A, 2)
    assert_close(A2, A, atol=1e-8, message="rank-2 approximation of a 2x2 matrix must equal A")
    assert_close(error, 0.0, atol=1e-8, message="error of the exact approximation must be 0")
