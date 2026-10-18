"""Visible tests. `gb_fit`, `gb_predict`, `select_learning_rate` and `assert_close`
come from the runner. `fit_stump` and `predict_stump` are the helpers from starter.py.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np

STEP_X = np.array([[0.0], [1.0], [2.0], [3.0]])
STEP_Y = np.array([0.0, 0.0, 1.0, 1.0])


def test_zero_rounds_predicts_the_mean():
    X = np.array([[0.0], [1.0], [2.0]])
    y = np.array([2.0, 4.0, 9.0])
    model = gb_fit(X, y, X, y, 0, 0.5, None)
    assert model["best_iter"] == 0, f"expected 0 trees, got {model['best_iter']}"
    pred = gb_predict(model, X)
    assert_close(pred, [5.0, 5.0, 5.0], atol=1e-9, message=f"expected the mean 5.0, got {pred}")


def test_one_round_with_unit_rate_fits_step_exactly():
    # Start is mean(y) = 0.5; residuals are -0.5, -0.5, 0.5, 0.5; one stump at 1.5 fits them.
    model = gb_fit(STEP_X, STEP_Y, STEP_X, STEP_Y, 1, 1.0, None)
    pred = gb_predict(model, STEP_X)
    assert_close(
        pred, STEP_Y, atol=1e-6, message=f"expected {STEP_Y.tolist()}, got {pred.tolist()}"
    )
    assert len(model["val_mse"]) == 1, f"expected 1 validation value, got {model['val_mse']}"


def test_shrinkage_scales_the_step():
    # With learning_rate 0.1 each leaf moves only a tenth of the residual.
    model = gb_fit(STEP_X, STEP_Y, STEP_X, STEP_Y, 1, 0.1, None)
    expected = [0.45, 0.45, 0.55, 0.55]
    pred = gb_predict(model, STEP_X)
    assert_close(pred, expected, atol=1e-6, message=f"expected {expected}, got {pred.tolist()}")
    assert model["best_iter"] == 1, (
        f"the single round improves validation, got {model['best_iter']}"
    )


def test_kept_trees_match_the_best_validation_round():
    rng = np.random.default_rng(1)
    X = rng.uniform(-2, 2, size=(80, 1))
    y = np.sin(X[:, 0]) + 0.2 * rng.normal(size=80)
    model = gb_fit(X[:50], y[:50], X[50:], y[50:], 30, 0.3, None)
    assert len(model["val_mse"]) == 30, f"expected 30 values, got {len(model['val_mse'])}"
    best = int(np.argmin(model["val_mse"])) + 1
    assert model["best_iter"] == best, f"expected best round {best}, got {model['best_iter']}"
    assert len(model["stumps"]) == best, f"expected {best} stumps, got {len(model['stumps'])}"


def test_early_stopping_runs_patience_rounds_after_the_best():
    rng = np.random.default_rng(2)
    X = rng.uniform(-2, 2, size=(60, 1))
    y = np.sin(X[:, 0]) + 0.3 * rng.normal(size=60)
    X_val = rng.uniform(-2, 2, size=(40, 1))
    y_val = rng.normal(size=40)
    model = gb_fit(X, y, X_val, y_val, 200, 0.3, 5)
    assert model["stopped_at"] < 200, "validation noise must stop the run before 200 rounds"
    gap = model["stopped_at"] - model["best_iter"]
    assert gap == 5, f"expected to stop 5 rounds after the best one, got {gap}"


def test_select_learning_rate_returns_a_listed_rate():
    rng = np.random.default_rng(3)
    X = rng.uniform(-1, 1, size=(60, 1))
    y = X[:, 0] ** 2 + 0.1 * rng.normal(size=60)
    rates = [0.5, 0.1]
    best = select_learning_rate(X[:40], y[:40], X[40:], y[40:], rates, 20, 5)
    assert best["learning_rate"] in rates, f"expected one of {rates}, got {best['learning_rate']}"
    model = gb_fit(X[:40], y[:40], X[40:], y[40:], 20, best["learning_rate"], 5)
    assert best["n_trees"] == model["best_iter"], "n_trees must be the best round of that rate"
