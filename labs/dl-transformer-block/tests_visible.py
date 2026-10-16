"""Visible tests. `layer_norm`, `self_attention`, `position_wise_mlp` and
`transformer_block` come from the runner's namespace.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def _plain_ln(z):
    """LayerNorm with gamma = 1 and beta = 0."""
    return layer_norm(z, np.ones(z.shape[-1]), np.zeros(z.shape[-1]))


def _identity(z):
    return z


def _zeros(z):
    return np.zeros_like(z)


def _random_sublayers(rng, d, d_ff):
    """Random attention and MLP sublayers; the weights are fixed for every call."""
    Wq, Wk, Wv, Wo = (rng.normal(size=(d, d)) / np.sqrt(d) for _ in range(4))
    W1 = rng.normal(size=(d, d_ff)) / np.sqrt(d)
    W2 = rng.normal(size=(d_ff, d)) / np.sqrt(d_ff)
    b1 = rng.normal(size=d_ff) * 0.1
    b2 = rng.normal(size=d) * 0.1

    def attn(z):
        return self_attention(z, Wq, Wk, Wv, Wo, h=2)

    def mlp(z):
        return position_wise_mlp(z, W1, b1, W2, b2)

    return attn, mlp


def test_mlp_hand_case():
    # x = [1, -2]; relu(x) = [1, 0]; identity weights give [1, 0] + bias [0.5, 0.5].
    x = np.array([[1.0, -2.0]])
    out = position_wise_mlp(x, np.eye(2), np.zeros(2), np.eye(2), np.full(2, 0.5))
    expected = [[1.5, 0.5]]
    assert out.shape == (1, 2), f"expected shape (1, 2), got {out.shape}"
    assert_close(out, expected, atol=1e-9, message=f"expected {expected}, got {out.tolist()}")


def test_block_output_shape_matches_input():
    rng = np.random.default_rng(0)
    x = rng.normal(size=(5, 8))
    attn, mlp = _random_sublayers(rng, d=8, d_ff=16)
    for order in ("pre", "post"):
        out = transformer_block(x, attn, mlp, _plain_ln, _plain_ln, norm_order=order)
        assert out.shape == (5, 8), f"{order}-LN: expected output shape (5, 8), got {out.shape}"


def test_pre_ln_zero_sublayers_return_input():
    rng = np.random.default_rng(1)
    x = rng.normal(size=(4, 6))
    out = transformer_block(x, _zeros, _zeros, _plain_ln, _plain_ln, norm_order="pre")
    assert_close(out, x, atol=1e-12, message="Pre-LN with zero sublayers must return the input")


def test_post_ln_zero_sublayers_return_normalized_input():
    rng = np.random.default_rng(2)
    x = rng.normal(size=(4, 6)) * 3.0 + 1.0
    out = transformer_block(x, _zeros, _zeros, _plain_ln, _identity, norm_order="post")
    assert_close(
        out, _plain_ln(x), atol=1e-9, message="Post-LN with zero sublayers must return LN(input)"
    )
    assert_close(
        out.mean(axis=-1),
        np.zeros(4),
        atol=1e-6,
        message="each token must have zero mean after Post-LN",
    )


def test_pre_ln_hand_case_with_constant_attention():
    # attn returns ones, mlp returns zeros, normalizations are identities: z = x + 1.
    x = np.array([[0.0, 2.0], [-1.0, 3.0]])

    def ones(z):
        return np.ones_like(z)

    out = transformer_block(x, ones, _zeros, _identity, _identity, norm_order="pre")
    expected = x + 1.0
    assert_close(
        out, expected, atol=1e-12, message=f"expected {expected.tolist()}, got {out.tolist()}"
    )


def test_variants_differ_on_same_input():
    rng = np.random.default_rng(3)
    x = rng.normal(size=(6, 8))
    attn, mlp = _random_sublayers(rng, d=8, d_ff=16)
    pre = transformer_block(x, attn, mlp, _plain_ln, _plain_ln, norm_order="pre")
    post = transformer_block(x, attn, mlp, _plain_ln, _plain_ln, norm_order="post")
    assert np.abs(pre - post).max() > 1e-3, "Pre-LN and Post-LN must give different outputs"
