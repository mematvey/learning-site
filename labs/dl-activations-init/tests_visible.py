"""Visible tests. `xavier_init`, `he_init`, `activate`, `init_stack`, `forward_stack`,
`layer_stats`, `assert_close` and `np` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def test_init_shapes():
    rng = np.random.default_rng(0)
    w_x = xavier_init(4, 3, rng)
    w_h = he_init(4, 3, rng)
    assert w_x.shape == (3, 4), f"expected xavier shape (3, 4), got {w_x.shape}"
    assert w_h.shape == (3, 4), f"expected he shape (3, 4), got {w_h.shape}"


def test_he_std_matches_formula():
    # Var(w) = 2 / n_in; with 80000 samples the sample std is within 1% of the formula.
    rng = np.random.default_rng(0)
    w = he_init(200, 400, rng)
    expected_std = np.sqrt(2.0 / 200)
    assert_close(
        w.std(),
        expected_std,
        atol=0,
        rtol=0.05,
        message=f"he_init std should be sqrt(2/n_in) = {expected_std:.4f}",
    )


def test_xavier_std_matches_formula():
    # Var(w) = 2 / (n_in + n_out) = 2 / 600
    rng = np.random.default_rng(0)
    w = xavier_init(200, 400, rng)
    expected_std = np.sqrt(2.0 / 600)
    assert_close(
        w.std(),
        expected_std,
        atol=0,
        rtol=0.05,
        message=f"xavier_init std should be sqrt(2/(n_in+n_out)) = {expected_std:.4f}",
    )


def test_activations_hand_cases():
    z = np.array([-1.0, 0.0, 2.0])
    assert_close(activate(z, "relu"), [0.0, 0.0, 2.0], atol=1e-12, message="relu of [-1, 0, 2]")
    assert_close(activate(z, "tanh"), np.tanh(z), atol=1e-12, message="tanh of [-1, 0, 2]")
    assert_close(activate([0.0], "sigmoid"), [0.5], atol=1e-12, message="sigmoid(0) must be 0.5")


def test_init_stack_and_forward_shapes():
    rng = np.random.default_rng(0)
    x = rng.normal(size=(64, 16))
    weights = init_stack(16, 3, "he", rng)
    assert len(weights) == 3, f"expected 3 weight matrices, got {len(weights)}"
    acts = forward_stack(x, weights, "relu")
    assert len(acts) == 3, f"expected 3 layer outputs, got {len(acts)}"
    assert acts[0].shape == (64, 16), f"expected layer output shape (64, 16), got {acts[0].shape}"
    means, variances = layer_stats(acts)
    assert means.shape == (3,), f"expected 3 layer means, got shape {means.shape}"
    assert variances.shape == (3,), f"expected 3 layer variances, got shape {variances.shape}"


def test_layer_stats_hand_case():
    a = np.array([[0.0, 2.0], [0.0, 2.0]])
    means, variances = layer_stats([a])
    assert_close(means, [1.0], atol=1e-12, message="mean of [[0, 2], [0, 2]] is 1")
    assert_close(variances, [1.0], atol=1e-12, message="population variance of [0, 2, 0, 2] is 1")
