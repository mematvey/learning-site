"""Online softmax and tiled attention: starter code.

Scores are processed in tiles (blocks of key positions). For every row the
running maximum m, the running sum l = sum(exp(x - m)) and, for attention, the
running output accumulator are updated tile by tile. Complete the `# TODO`
parts so that the tiled result matches `naive_attention`.
"""

import numpy as np


def naive_attention(Q, K, V):
    """Reference attention: softmax(Q K^T / sqrt(d)) V, with the full N x N matrix."""
    d = Q.shape[-1]
    S = Q @ K.T / np.sqrt(d)
    S = S - S.max(axis=-1, keepdims=True)
    P = np.exp(S)
    P = P / P.sum(axis=-1, keepdims=True)
    return P @ V


def online_softmax(scores, block_size):
    """Running maximum and normalizer of one row, computed tile by tile.

    `scores` is a 1-D array of length N. Split it into consecutive tiles of
    `block_size` elements (the last tile may be shorter). Return (m, l) where
    m = max(scores) and l = sum(exp(scores - m)), without a second pass over
    the row.
    """
    # TODO: for each tile, keep the running max m and the running sum l;
    # when the max changes, rescale the old sum by exp(m_old - m_new)
    raise NotImplementedError


def tiled_attention(Q, K, V, block_size):
    """Attention output O of shape (N, d_v), computed over key/value tiles.

    Q has shape (N, d), K has shape (N, d), V has shape (N, d_v). Process the
    keys and values in tiles of `block_size` rows. For each query row keep
    m, l and the accumulator a = sum(exp(s - m) * v); after the last tile the
    output is a / l. The result must equal `naive_attention(Q, K, V)`.
    """
    # TODO: loop over key/value tiles; update m, l, a for all query rows at once
    raise NotImplementedError
