"""Visible tests. `fit_stump`, `predict_stump`, `bagging_*`, `gb_*` and `assert_close`
come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np

STEP_X = np.array([[0.0], [1.0], [2.0], [3.0]])
STEP_Y = np.array([0.0, 0.0, 1.0, 1.0])


def test_stump_separates_step_function():
    stump = fit_stump(STEP_X, STEP_Y)
    pred = predict_stump(stump, STEP_X)
    assert pred.shape == (4,), f"expected prediction shape (4,), got {pred.shape}"
    assert_close(
        pred, STEP_Y, atol=1e-6, message=f"expected {STEP_Y.tolist()}, got {pred.tolist()}"
    )


def test_bagging_returns_requested_number_of_stumps():
    rng = np.random.default_rng(0)
    X = rng.normal(size=(30, 2))
    y = X[:, 0] + 0.1 * rng.normal(size=30)
    stumps = bagging_fit(X, y, n_estimators=7, seed=0)
    assert len(stumps) == 7, f"expected 7 stumps, got {len(stumps)}"
    pred = bagging_predict(stumps, X)
    assert pred.shape == (30,), f"expected prediction shape (30,), got {pred.shape}"


def test_bagging_predict_is_average_of_stumps():
    stumps = [(0, 1.5, -1.0, 1.0), (0, 0.5, 0.0, 2.0)]
    expected = [(-1.0 + 0.0) / 2, (-1.0 + 2.0) / 2, (1.0 + 2.0) / 2, (1.0 + 2.0) / 2]
    pred = bagging_predict(stumps, STEP_X)
    assert_close(pred, expected, atol=1e-6, message=f"expected {expected}, got {pred.tolist()}")


def test_gb_one_step_with_unit_rate_fits_step_exactly():
    # Start is mean(y) = 0.5; residuals are -0.5, -0.5, 0.5, 0.5; one stump at 1.5 fits them.
    model = gb_fit(STEP_X, STEP_Y, n_estimators=1, learning_rate=1.0)
    pred = gb_predict(model, STEP_X)
    assert_close(
        pred, STEP_Y, atol=1e-6, message=f"expected {STEP_Y.tolist()}, got {pred.tolist()}"
    )


def test_gb_shrinkage_scales_the_step():
    # With learning_rate 0.1 each leaf moves only a tenth of the residual.
    model = gb_fit(STEP_X, STEP_Y, n_estimators=1, learning_rate=0.1)
    expected = [0.45, 0.45, 0.55, 0.55]
    pred = gb_predict(model, STEP_X)
    assert_close(pred, expected, atol=1e-6, message=f"expected {expected}, got {pred.tolist()}")


def test_gb_more_steps_fit_training_data_better():
    rng = np.random.default_rng(1)
    X = rng.uniform(-2, 2, size=(60, 1))
    y = np.sin(X[:, 0])
    mse_1 = np.mean((gb_predict(gb_fit(X, y, 1, 0.3), X) - y) ** 2)
    mse_20 = np.mean((gb_predict(gb_fit(X, y, 20, 0.3), X) - y) ** 2)
    assert mse_20 < mse_1, f"training MSE must drop with more steps: {mse_1:.4f} -> {mse_20:.4f}"
