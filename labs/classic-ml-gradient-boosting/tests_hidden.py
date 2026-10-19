"""Hidden tests: edge cases, consistency and scale.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def test_hidden_constant_target_stops_at_patience():
    rng = np.random.default_rng(20)
    X = rng.normal(size=(30, 2))
    y = np.full(30, 3.0)
    model = gb_fit(X, y, X, y, 5, 0.3, 2)
    assert model["stopped_at"] == 2, "no round improves, so the run must stop after 2 rounds"
    assert model["best_iter"] == 0, "no round improves, so no trees must be kept"
    assert_close(gb_predict(model, X), y, atol=1e-9, message="constant target must be kept")


def test_hidden_without_early_stopping_all_rounds_run():
    rng = np.random.default_rng(21)
    X = rng.normal(size=(50, 2))
    y = X[:, 0] - 0.5 * X[:, 1] + 0.3 * rng.normal(size=50)
    model = gb_fit(X[:35], y[:35], X[35:], y[35:], 7, 0.2, None)
    assert model["stopped_at"] == 7, f"expected 7 rounds, got {model['stopped_at']}"
    assert len(model["val_mse"]) == 7, "validation history must have one value per round"


def test_hidden_kept_model_gives_best_validation_error():
    rng = np.random.default_rng(22)
    X = rng.uniform(-1, 1, size=(90, 2))
    y = X[:, 0] ** 2 + 0.5 * X[:, 1] + 0.1 * rng.normal(size=90)
    model = gb_fit(X, y, X, y, 25, 0.2, 4)
    mse = float(np.mean((gb_predict(model, X) - y) ** 2))
    assert abs(mse - model["best_val_mse"]) < 1e-9, "kept model must reach the best validation MSE"


def test_hidden_first_validation_value_is_one_shrunken_stump():
    rng = np.random.default_rng(23)
    X = rng.normal(size=(40, 2))
    y = X[:, 1] + 0.2 * rng.normal(size=40)
    X_val = rng.normal(size=(15, 2))
    y_val = X_val[:, 1]
    model = gb_fit(X, y, X_val, y_val, 1, 0.25, None)
    stump = fit_stump(X, y - y.mean())
    pred = y.mean() + 0.25 * predict_stump(stump, X_val)
    expected = float(np.mean((pred - y_val) ** 2))
    assert abs(model["val_mse"][0] - expected) < 1e-9, "mismatch on random input, seed 23"


def test_hidden_select_returns_the_lowest_best_error():
    rng = np.random.default_rng(24)
    X = rng.uniform(-1, 1, size=(100, 2))
    y = np.sin(3 * X[:, 0]) + X[:, 1] + 0.2 * rng.normal(size=100)
    rates = [0.01, 0.3, 0.1]
    best = select_learning_rate(X[:70], y[:70], X[70:], y[70:], rates, 60, 6)
    errors = [gb_fit(X[:70], y[:70], X[70:], y[70:], 60, r, 6)["best_val_mse"] for r in rates]
    assert abs(best["val_mse"] - min(errors)) < 1e-12, "mismatch on random input, seed 24"


def test_hidden_deterministic_for_same_data():
    rng = np.random.default_rng(25)
    X = rng.normal(size=(60, 3))
    y = X[:, 0] * X[:, 2] + 0.1 * rng.normal(size=60)
    a = gb_fit(X[:40], y[:40], X[40:], y[40:], 15, 0.1, 3)
    b = gb_fit(X[:40], y[:40], X[40:], y[40:], 15, 0.1, 3)
    assert a["best_iter"] == b["best_iter"], "same input must give the same best round"
    assert a["val_mse"] == b["val_mse"], "same input must give the same validation curve"


def test_hidden_scale_improves_on_mean_baseline():
    rng = np.random.default_rng(26)
    X = rng.normal(size=(300, 4))
    y = 2.0 * X[:, 0] - X[:, 1] + 0.1 * rng.normal(size=300)
    model = gb_fit(X[:200], y[:200], X[200:], y[200:], 80, 0.1, 10)
    pred = gb_predict(model, X[200:])
    mse = float(np.mean((pred - y[200:]) ** 2))
    assert mse < 0.2 * float(np.var(y[200:])), "mismatch on random input, seed 26"
