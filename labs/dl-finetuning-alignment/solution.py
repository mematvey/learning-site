"""LoRA layer on NumPy: reference solution."""

import numpy as np


def lora_forward(W0, A, B, x, alpha=None):
    """Output of a LoRA-adapted linear layer. Returns shape (d,) or (n, d).

    W0: frozen weights, shape (d, k). A: shape (r, k). B: shape (d, r).
    x: input, shape (k,) or (n, k). alpha: optional constant; if given, the
    low-rank term is multiplied by alpha / r, where r = A.shape[0].
    """
    W0 = np.asarray(W0, dtype=np.float64)
    A = np.asarray(A, dtype=np.float64)
    B = np.asarray(B, dtype=np.float64)
    x = np.asarray(x, dtype=np.float64)

    r = A.shape[0]
    scale = 1.0 if alpha is None else alpha / r
    frozen = x @ W0.T
    # Apply A first, then B: the update is never built as a d x k matrix.
    update = (x @ A.T) @ B.T
    return frozen + scale * update


def count_full_params(d, k):
    """Number of trainable values when the whole d x k matrix is fine-tuned."""
    return d * k


def count_lora_params(d, k, r):
    """Number of trainable values in the LoRA update of a d x k matrix with rank r."""
    return r * (d + k)


def trainable_fraction(d, k, r):
    """Share of trainable values in the LoRA update relative to the full matrix."""
    return count_lora_params(d, k, r) / count_full_params(d, k)
