"""Hidden tests: scale over depth, determinism, edge cases and numerical stability.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def _stack_variances(scheme, kind, seed):
    rng = np.random.default_rng(seed)
    x = rng.normal(size=(256, 512))
    weights = init_stack(512, 10, scheme, np.random.default_rng(seed + 100))
    _, variances = layer_stats(forward_stack(x, weights, kind))
    return variances


def test_hidden_he_relu_keeps_scale_over_depth():
    v = _stack_variances("he", "relu", 0)
    ratio = v[-1] / v[0]
    assert 0.6 < ratio < 1.6, f"he + relu variance ratio last/first out of range: {ratio:.3f}"


def test_hidden_xavier_relu_halves_each_layer():
    v = _stack_variances("xavier", "relu", 0)
    for layer in range(4):
        step = v[layer + 1] / v[layer]
        assert 0.3 < step < 0.7, f"xavier + relu step {layer}->{layer + 1} out of range: {step:.3f}"
    assert v[-1] < 0.01 * v[0], "xavier + relu must shrink variance strongly over 10 layers"


def test_hidden_init_is_seeded():
    a = init_stack(8, 2, "xavier", np.random.default_rng(42))
    b = init_stack(8, 2, "xavier", np.random.default_rng(42))
    for wa, wb in zip(a, b):
        assert np.array_equal(wa, wb), "same seed must give identical weights"


def test_hidden_depth_one_and_square_shapes():
    rng = np.random.default_rng(5)
    w = init_stack(6, 1, "he", rng)
    assert len(w) == 1 and w[0].shape == (6, 6), "init_stack must return (width, width) matrices"
    acts = forward_stack(np.ones((2, 6)), w, "tanh")
    assert len(acts) == 1 and acts[0].shape == (2, 6), "single-layer forward shape mismatch"


def test_hidden_sigmoid_is_stable():
    p = activate(np.array([-1000.0, 0.0, 1000.0]), "sigmoid")
    assert np.all(np.isfinite(p)), "sigmoid must stay finite for large |z|"
    assert_close(p, [0.0, 0.5, 1.0], atol=1e-12, message="sigmoid at extreme inputs")


def test_hidden_relu_and_tanh_on_random_input():
    rng = np.random.default_rng(7)
    z = rng.normal(size=(5, 9)) * 3.0
    assert_close(
        activate(z, "relu"),
        np.maximum(z, 0.0),
        atol=1e-12,
        message="relu mismatch on random input, seed 7",
    )
    assert_close(
        activate(z, "tanh"), np.tanh(z), atol=1e-12, message="tanh mismatch on random input, seed 7"
    )


def test_hidden_unknown_names_raise():
    failed = []
    try:
        activate(np.zeros(2), "gelu")
        failed.append("activate")
    except ValueError:
        pass
    try:
        init_stack(4, 2, "orthogonal", np.random.default_rng(0))
        failed.append("init_stack")
    except ValueError:
        pass
    assert not failed, "unknown name must raise ValueError"


def test_hidden_inputs_not_modified():
    rng = np.random.default_rng(2)
    x = rng.normal(size=(3, 4))
    x_copy = x.copy()
    weights = init_stack(4, 2, "he", rng)
    forward_stack(x, weights, "relu")
    assert np.array_equal(x, x_copy), "forward_stack must not modify its input"
