import numpy as np


def attention(Q, K, V, mask=None):
    # TODO: scale by sqrt(d) and apply the mask
    scores = Q @ K.T
    return scores @ V
