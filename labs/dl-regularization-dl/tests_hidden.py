"""Hidden tests: averaging over masks, rates, edge cases and purity of the functions.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def test_hidden_mean_over_masks_is_close_to_input():
    rng = np.random.default_rng(0)
    x = rng.normal(size=(3, 4))
    acc = np.zeros_like(x)
    n = 20000
    for _ in range(n):
        out, _ = dropout(x, 0.5, rng=rng)
        acc += out
    assert_close(
        acc / n,
        x,
        atol=0.1,
        rtol=0,
        message="mean over many masks must be close to the input, seed 0",
    )


def test_hidden_keep_rate_matches_one_minus_p():
    x = np.ones(100000)
    out, mask = dropout(x, 0.3, rng=np.random.default_rng(5))
    keep_rate = float(np.mean(mask))
    assert abs(keep_rate - 0.7) < 0.01, "keep rate on random input must be close to 1 - p, seed 5"
    assert abs(float(np.mean(out)) - 1.0) < 0.02, "mean output must be close to input, seed 5"


def test_hidden_p_zero_is_identity_in_training():
    x = np.arange(6, dtype=float).reshape(2, 3)
    out, mask = dropout(x, 0.0, rng=np.random.default_rng(2))
    assert_close(out, x, atol=1e-12, rtol=0, message="p = 0 must keep every element")
    assert np.all(mask == 1), "p = 0 must give a mask of ones"


def test_hidden_invalid_p_raises():
    x = np.ones((2, 2))
    for bad_p in (1.0, -0.1):
        try:
            dropout(x, bad_p)
        except ValueError:
            continue
        raise AssertionError("p outside [0, 1) must raise ValueError")


def test_hidden_same_seed_gives_same_mask():
    x = np.ones((5, 5))
    out_a, mask_a = dropout(x, 0.5, rng=np.random.default_rng(9))
    out_b, mask_b = dropout(x, 0.5, rng=np.random.default_rng(9))
    assert np.array_equal(mask_a, mask_b), "same seed must give the same mask"
    assert np.array_equal(out_a, out_b), "same seed must give the same output"


def test_hidden_inputs_not_mutated():
    rng = np.random.default_rng(7)
    x = rng.normal(size=(2, 3))
    w = rng.normal(size=(2, 3))
    g = rng.normal(size=(2, 3))
    x_copy, w_copy, g_copy = x.copy(), w.copy(), g.copy()
    dropout(x, 0.5, rng=np.random.default_rng(1))
    dropout(x, 0.5, training=False)
    weight_decay_step(w, g, 0.1, 0.01)
    adamw_step(w, g, np.zeros_like(w), np.zeros_like(w), 1, 0.1, 0.01)
    assert np.array_equal(x, x_copy), "dropout must not modify its input"
    assert np.array_equal(w, w_copy), "weight functions must not modify weights"
    assert np.array_equal(g, g_copy), "weight functions must not modify gradients"


def test_hidden_weight_decay_zero_is_plain_sgd():
    rng = np.random.default_rng(3)
    w = rng.normal(size=(4, 3))
    g = rng.normal(size=(4, 3))
    assert_close(
        weight_decay_step(w, g, 0.05, 0.0),
        w - 0.05 * g,
        atol=1e-9,
        message="weight_decay = 0 must reduce to plain gradient descent",
    )


def test_hidden_weight_decay_matrix_formula():
    rng = np.random.default_rng(4)
    w = rng.normal(size=(3, 5))
    g = rng.normal(size=(3, 5))
    lr, wd = 0.2, 0.5
    assert_close(
        weight_decay_step(w, g, lr, wd),
        (1 - lr * wd) * w - lr * g,
        atol=1e-9,
        message="mismatch on random matrix, seed 4",
    )


def test_hidden_adamw_zero_gradient_is_pure_decay():
    # With zero gradient the Adam part is 0, so only the decoupled decay acts.
    rng = np.random.default_rng(6)
    w = rng.normal(size=(2, 4))
    zeros = np.zeros_like(w)
    w_new, m_new, v_new = adamw_step(w, zeros, zeros, zeros, t=3, lr=0.1, weight_decay=0.2)
    assert_close(
        w_new,
        (1 - 0.1 * 0.2) * w,
        atol=1e-9,
        message="zero gradient must give pure weight decay, seed 6",
    )
    assert np.all(m_new == 0) and np.all(v_new == 0), "moments must stay zero for zero gradient"


def test_hidden_adamw_multi_step_matches_reference():
    rng = np.random.default_rng(8)
    grads = rng.normal(size=(6, 3))
    w = rng.normal(size=3)
    m = np.zeros(3)
    v = np.zeros(3)
    lr, wd, b1, b2, eps = 0.01, 0.1, 0.9, 0.999, 1e-8
    w_ref, m_ref, v_ref = w.copy(), m.copy(), v.copy()
    for t, g in enumerate(grads, start=1):
        w, m, v = adamw_step(w, g, m, v, t, lr, wd, beta1=b1, beta2=b2, eps=eps)
        m_ref = b1 * m_ref + (1 - b1) * g
        v_ref = b2 * v_ref + (1 - b2) * g * g
        m_hat = m_ref / (1 - b1**t)
        v_hat = v_ref / (1 - b2**t)
        w_ref = w_ref - lr * (m_hat / (np.sqrt(v_hat) + eps) + wd * w_ref)
    assert_close(w, w_ref, atol=1e-9, message="multi-step AdamW mismatch, seed 8")
    assert_close(v, v_ref, atol=1e-12, message="second moment mismatch, seed 8")
