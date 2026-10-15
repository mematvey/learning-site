import numpy as np


def test_shape():
    Q = np.ones((2, 3))
    K = np.ones((4, 3))
    V = np.ones((4, 5))
    assert attention(Q, K, V).shape == (2, 5)
