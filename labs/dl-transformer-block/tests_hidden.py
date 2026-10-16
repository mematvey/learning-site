"""Hidden tests: formulas, token independence, edge cases and stability.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def _make_ln(gamma_scale, beta_shift):
    def norm(z):
        d = z.shape[-1]
        return layer_norm(z, np.full(d, gamma_scale), np.full(d, beta_shift))

    return norm


def _make_sublayers(rng, d, d_ff):
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


def _zeros(z):
    return np.zeros_like(z)


def _identity_norm(z):
    return z


def test_hidden_pre_ln_formula_with_distinct_norms():
    # ln1 and ln2 differ, so swapping them would change the result.
    rng = np.random.default_rng(10)
    x = rng.normal(size=(5, 8))
    attn, mlp = _make_sublayers(rng, 8, 16)
    ln1, ln2 = _make_ln(2.0, 0.0), _make_ln(1.0, 1.0)
    y = x + attn(ln1(x))
    expected = y + mlp(ln2(y))
    out = transformer_block(x, attn, mlp, ln1, ln2, norm_order="pre")
    assert_close(
        out,
        expected,
        atol=1e-6,
        rtol=1e-5,
        message="Pre-LN output mismatch on random input, seed 10",
    )


def test_hidden_post_ln_formula_with_distinct_norms():
    rng = np.random.default_rng(11)
    x = rng.normal(size=(5, 8))
    attn, mlp = _make_sublayers(rng, 8, 16)
    ln1, ln2 = _make_ln(2.0, 0.0), _make_ln(1.0, 1.0)
    y = ln1(x + attn(x))
    expected = ln2(y + mlp(y))
    out = transformer_block(x, attn, mlp, ln1, ln2, norm_order="post")
    assert_close(
        out,
        expected,
        atol=1e-6,
        rtol=1e-5,
        message="Post-LN output mismatch on random input, seed 11",
    )


def test_hidden_pre_ln_random_zero_sublayers_identity():
    rng = np.random.default_rng(12)
    x = rng.normal(size=(3, 6)) * 5.0
    out = transformer_block(
        x, _zeros, _zeros, _make_ln(1.0, 0.0), _make_ln(3.0, 2.0), norm_order="pre"
    )
    assert_close(out, x, atol=1e-12, message="Pre-LN with zero sublayers must return input")


def test_hidden_post_ln_double_norm_with_zero_sublayers():
    rng = np.random.default_rng(13)
    x = rng.normal(size=(4, 5))
    ln1, ln2 = _make_ln(1.0, 0.0), _make_ln(1.0, 0.0)
    expected = ln2(ln1(x))
    out = transformer_block(x, _zeros, _zeros, ln1, ln2, norm_order="post")
    assert_close(
        out, expected, atol=1e-9, message="Post-LN with zero sublayers must return ln2(ln1(input))"
    )


def test_hidden_mlp_is_token_wise():
    # The MLP must not mix tokens: permuting rows permutes the output the same way.
    rng = np.random.default_rng(14)
    x = rng.normal(size=(6, 4))
    _, mlp = _make_sublayers(rng, 4, 8)
    perm = np.array([3, 0, 5, 1, 4, 2])
    assert_close(
        mlp(x[perm]),
        mlp(x)[perm],
        atol=1e-9,
        message="position-wise MLP must act on each token independently",
    )


def test_hidden_mlp_matches_loop_reference():
    rng = np.random.default_rng(15)
    x = rng.normal(size=(4, 3))
    W1 = rng.normal(size=(3, 12))
    b1 = rng.normal(size=12)
    W2 = rng.normal(size=(12, 3))
    b2 = rng.normal(size=3)
    ref = np.zeros((4, 3))
    for i in range(4):
        hidden = np.maximum(x[i] @ W1 + b1, 0.0)
        ref[i] = hidden @ W2 + b2
    assert_close(
        position_wise_mlp(x, W1, b1, W2, b2),
        ref,
        atol=1e-6,
        rtol=1e-5,
        message="MLP mismatch on random input, seed 15",
    )


def test_hidden_single_token():
    rng = np.random.default_rng(16)
    x = rng.normal(size=(1, 8))
    attn, mlp = _make_sublayers(rng, 8, 16)
    for order in ("pre", "post"):
        out = transformer_block(
            x, attn, mlp, _make_ln(1.0, 0.0), _make_ln(1.0, 0.0), norm_order=order
        )
        assert out.shape == (1, 8), f"{order}-LN: expected shape (1, 8), got {out.shape}"


def test_hidden_large_activations_stay_finite():
    rng = np.random.default_rng(17)
    x = rng.normal(size=(4, 8)) * 1e4
    attn, mlp = _make_sublayers(rng, 8, 16)
    for order in ("pre", "post"):
        out = transformer_block(
            x, attn, mlp, _make_ln(1.0, 0.0), _make_ln(1.0, 0.0), norm_order=order
        )
        assert np.all(np.isfinite(out)), f"{order}-LN: non-finite output for large inputs"


def test_hidden_inputs_not_mutated():
    rng = np.random.default_rng(18)
    x = rng.normal(size=(3, 4))
    x_copy = x.copy()
    attn, mlp = _make_sublayers(rng, 4, 8)
    for order in ("pre", "post"):
        transformer_block(x, attn, mlp, _make_ln(1.0, 0.0), _make_ln(1.0, 0.0), norm_order=order)
    assert np.array_equal(x, x_copy), "input must not be modified"


def test_hidden_unknown_norm_order_raises():
    try:
        transformer_block(
            np.ones((2, 3)), _zeros, _zeros, _identity_norm, _identity_norm, norm_order="middle"
        )
    except ValueError:
        return
    raise AssertionError("unknown norm_order must raise ValueError")
