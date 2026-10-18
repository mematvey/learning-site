"""LoRA layer on NumPy: forward pass and trainable parameter counts.

A frozen weight matrix W0 has shape (d, k). LoRA adds a low-rank update made of
two small trainable matrices: A with shape (r, k) and B with shape (d, r).
The layer output is

    h = W0 x + scale * B (A x),    scale = alpha / r,

where scale is 1 when alpha is None.

Inputs x are either one vector of shape (k,) or a batch of rows of shape (n, k).
The output has the same leading shape with last dimension d.
"""

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

    # TODO: return W0 x + scale * B (A x). Use @ and transposes so that one
    # expression works for both (k,) and (n, k) inputs.
    raise NotImplementedError


def count_full_params(d, k):
    """Number of trainable values when the whole d x k matrix is fine-tuned."""
    # TODO: return the number of entries of a d x k matrix
    raise NotImplementedError


def count_lora_params(d, k, r):
    """Number of trainable values in the LoRA update of a d x k matrix with rank r."""
    # TODO: count the entries of A (r x k) and B (d x r)
    raise NotImplementedError


def trainable_fraction(d, k, r):
    """Share of trainable values in the LoRA update relative to the full matrix."""
    # TODO: divide the LoRA count by the full count
    raise NotImplementedError
