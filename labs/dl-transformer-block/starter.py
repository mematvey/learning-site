"""Transformer block: starter code.

`layer_norm` and `self_attention` are ready to use. Complete `position_wise_mlp`
and `transformer_block` so that they match the chapter text:

- Pre-LN:  y = x + Attn(LN(x)),  z = y + MLP(LN(y))
- Post-LN: y = LN(x + Attn(x)),  z = LN(y + MLP(y))
"""

import numpy as np


def layer_norm(x, gamma, beta, eps=1e-5):
    """LayerNorm over the last axis (ready). gamma, beta: (d,)."""
    x = np.asarray(x, dtype=np.float64)
    gamma = np.asarray(gamma, dtype=np.float64)
    beta = np.asarray(beta, dtype=np.float64)
    mean = x.mean(axis=-1, keepdims=True)
    var = ((x - mean) ** 2).mean(axis=-1, keepdims=True)
    return gamma * (x - mean) / np.sqrt(var + eps) + beta


def self_attention(X, W_q, W_k, W_v, W_o, h):
    """Multi-head self-attention (ready). X: (n, d); returns (n, d)."""
    X = np.asarray(X, dtype=np.float64)
    n, d = X.shape
    d_k = d // h

    def split(M):
        return M.reshape(n, h, d_k).transpose(1, 0, 2)

    Q = split(X @ W_q)
    K = split(X @ W_k)
    V = split(X @ W_v)
    scores = Q @ K.transpose(0, 2, 1) / np.sqrt(d_k)
    shifted = scores - scores.max(axis=-1, keepdims=True)
    exp = np.exp(shifted)
    weights = exp / exp.sum(axis=-1, keepdims=True)
    heads = weights @ V
    merged = heads.transpose(1, 0, 2).reshape(n, d)
    return merged @ W_o


def position_wise_mlp(x, W1, b1, W2, b2):
    """MLP applied to each token separately, with the same weights for all tokens.

    x: (n, d); W1: (d, d_ff); b1: (d_ff,); W2: (d_ff, d); b2: (d,).
    Returns relu(x @ W1 + b1) @ W2 + b2 with shape (n, d).
    """
    x = np.asarray(x, dtype=np.float64)
    # TODO: two linear layers with a ReLU between them
    raise NotImplementedError


def transformer_block(x, attn, mlp, ln1, ln2, norm_order="pre"):
    """One transformer block with residual connections.

    x: (n, d) input. attn, mlp: functions (n, d) -> (n, d) for the two sublayers.
    ln1, ln2: normalization functions (n, d) -> (n, d).
    norm_order="pre":  y = x + attn(ln1(x)),  z = y + mlp(ln2(y))
    norm_order="post": y = ln1(x + attn(x)),  z = ln2(y + mlp(y))
    Returns z with the same shape as x. Any other norm_order raises ValueError.
    """
    x = np.asarray(x, dtype=np.float64)
    # TODO: implement both orders of normalization, see the formulas above
    raise NotImplementedError
