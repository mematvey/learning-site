"""Hidden tests: reference comparisons, shapes, numerical stability and invariances.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np

if "assert_close" not in globals():
    # Fallback for scripts/lab_check.py, which does not inject the harness helper.
    # In the browser the harness provides assert_close with the full diff table.
    def assert_close(actual, expected, atol=1e-6, rtol=1e-5, message=None):
        a = np.asarray(actual, dtype=float)
        e = np.asarray(expected, dtype=float)
        if a.shape != e.shape:
            raise AssertionError(message or f"shape {a.shape}, expected {e.shape}")
        if not np.allclose(a, e, atol=atol, rtol=rtol):
            raise AssertionError(message or f"max deviation {np.max(np.abs(a - e)):.3g}")


def _ref_layer_norm(x, gamma, beta, eps):
    """Row-by-row reference: one token at a time, explicit loops."""
    out = np.zeros_like(x, dtype=np.float64)
    for idx in np.ndindex(x.shape[:-1]):
        row = x[idx]
        mu = sum(row) / row.size
        var = sum((row - mu) ** 2) / row.size
        out[idx] = gamma * (row - mu) / np.sqrt(var + eps) + beta
    return out


def _ref_rms_norm(x, gamma, eps):
    out = np.zeros_like(x, dtype=np.float64)
    for idx in np.ndindex(x.shape[:-1]):
        row = x[idx]
        ms = sum(row**2) / row.size
        out[idx] = gamma * row / np.sqrt(ms + eps)
    return out


def test_hidden_layer_norm_matches_reference_3d():
    rng = np.random.default_rng(0)
    x = rng.normal(size=(2, 5, 16))
    gamma = rng.normal(size=16)
    beta = rng.normal(size=16)
    out = layer_norm(x, gamma, beta, eps=1e-5)
    assert_close(out, _ref_layer_norm(x, gamma, beta, 1e-5), atol=1e-8, rtol=1e-6)


def test_hidden_rms_norm_matches_reference():
    rng = np.random.default_rng(1)
    x = rng.normal(size=(3, 4, 10))
    gamma = rng.uniform(0.5, 2.0, size=10)
    out = rms_norm(x, gamma, eps=1e-5)
    assert_close(out, _ref_rms_norm(x, gamma, 1e-5), atol=1e-8, rtol=1e-6)


def test_hidden_one_dimensional_input():
    rng = np.random.default_rng(2)
    x = rng.normal(size=8)
    gamma = np.ones(8)
    beta = np.zeros(8)
    out = layer_norm(x, gamma, beta, eps=1e-5)
    assert out.shape == (8,), f"expected shape (8,) for a single vector, got {out.shape}"
    assert_close(out, _ref_layer_norm(x, gamma, beta, 1e-5), atol=1e-8, rtol=1e-6)


def test_hidden_large_offset_stability():
    # The naive E[x^2] - E[x]^2 formula loses all precision when the mean is 1e8.
    rng = np.random.default_rng(3)
    base = rng.normal(size=(3, 8))
    gamma = np.ones(8)
    beta = np.zeros(8)
    shifted = layer_norm(base + 1e8, gamma, beta, eps=0.0)
    centred = layer_norm(base, gamma, beta, eps=0.0)
    assert_close(shifted, centred, atol=1e-5, message="LayerNorm must be shift-invariant")


def test_hidden_scale_invariance_of_layer_norm_and_rms_norm():
    rng = np.random.default_rng(4)
    x = rng.normal(size=(4, 6))
    gamma = np.ones(6)
    beta = np.zeros(6)
    assert_close(
        layer_norm(5.0 * x, gamma, beta, eps=0.0),
        layer_norm(x, gamma, beta, eps=0.0),
        atol=1e-9,
        message="LayerNorm must be invariant to positive scaling of the input",
    )
    assert_close(
        rms_norm(5.0 * x, gamma, eps=0.0),
        rms_norm(x, gamma, eps=0.0),
        atol=1e-9,
        message="RMSNorm must be invariant to positive scaling of the input",
    )


def test_hidden_zero_gamma_gives_beta_and_input_not_modified():
    rng = np.random.default_rng(5)
    x = rng.normal(size=(3, 5))
    x_before = x.copy()
    beta = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
    out = layer_norm(x, np.zeros(5), beta, eps=1e-5)
    assert_close(out, np.tile(beta, (3, 1)), atol=1e-9, message="gamma = 0 must return beta")
    assert np.array_equal(x, x_before), "the input array must not be modified in place"
