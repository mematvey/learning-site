"""Visible tests. `layer_norm`, `rms_norm`, `assert_close` and `report_array` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
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


def test_output_shape_is_preserved():
    x = np.zeros((2, 3, 4))
    out = layer_norm(x, np.ones(4), np.zeros(4))
    assert out.shape == (2, 3, 4), f"expected shape (2, 3, 4), got {out.shape}"
    out_rms = rms_norm(x, np.ones(4))
    assert out_rms.shape == (2, 3, 4), f"expected shape (2, 3, 4), got {out_rms.shape}"


def test_mean_zero_unit_variance_per_token():
    # With gamma = 1, beta = 0 and tiny eps, each row (token) has mean 0 and variance 1.
    rng = np.random.default_rng(0)
    x = rng.normal(loc=3.0, scale=2.0, size=(4, 6))
    out = layer_norm(x, np.ones(6), np.zeros(6), eps=1e-12)
    report_array("normalized", out)
    assert_close(out.mean(axis=-1), np.zeros(4), atol=1e-6, message="row means must be 0")
    assert_close(out.var(axis=-1), np.ones(4), atol=1e-6, message="row variances must be 1")


def test_gamma_and_beta_scale_and_shift():
    # Row [1, 2, 3, 4]: mean 2.5, var 1.25. With gamma = 2 and beta = 1 each value is 2 * x_hat + 1.
    x = np.array([[1.0, 2.0, 3.0, 4.0]])
    out = layer_norm(x, np.full(4, 2.0), np.full(4, 1.0), eps=0.0)
    expected = np.array([[-1.683282, 0.105573, 1.894427, 3.683282]])
    assert_close(out, expected, atol=1e-6, message="gamma/beta affine output mismatch")


def test_constant_row_gives_beta_because_of_eps():
    # A constant row has zero variance, so x_hat = 0 (eps keeps the division finite) and y = beta.
    x = np.full((2, 4), 3.0)
    beta = np.array([0.5, -0.5, 1.0, 0.0])
    out = layer_norm(x, np.ones(4), beta, eps=1e-5)
    assert_close(out, np.tile(beta, (2, 1)), atol=1e-9, message="constant input must map to beta")


def test_rms_norm_hand_case():
    # x = [3, 4]: mean(x**2) = 12.5, so y = [3, 4] / sqrt(12.5).
    x = np.array([[3.0, 4.0]])
    out = rms_norm(x, np.ones(2), eps=0.0)
    expected = np.array([[0.848528, 1.131371]])
    assert_close(out, expected, atol=1e-6, message="rms_norm hand case mismatch")
