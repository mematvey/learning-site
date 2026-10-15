import numpy as np


def test_rows_sum_to_one():
    Q = np.eye(3)
    K = np.eye(3)
    V = np.eye(3)
    weights = attention(Q, K, V)
    assert np.allclose(weights.sum(axis=-1), 1.0)
