"""Hidden tests: edge cases and rules that are not spelled out in the reader's tests.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821


def _raises(exc_type, fn):
    try:
        fn()
    except exc_type:
        return True
    except Exception:  # noqa: BLE001 - a different error type is a failure
        return False
    return False


def test_hidden_best_uses_final_value_not_best_step():
    # Run A dipped to 0.3 in the middle but finished at 0.5; run B finished at 0.45.
    a = new_run("a", {"lr": 0.1})
    for value in (0.9, 0.3, 0.5):
        log_metric(a, "val_loss", value)
    b = new_run("b", {"lr": 0.05})
    for value in (0.9, 0.4, 0.45):
        log_metric(b, "val_loss", value)
    assert best_run([a, b], "val_loss", mode="min")["run_id"] == "b", (
        "best_run must compare final values of the metric history"
    )


def test_hidden_max_tie_returns_earlier_run():
    runs = []
    for run_id in ("first", "second"):
        run = new_run(run_id, {"lr": 0.1})
        log_metric(run, "accuracy", 0.8)
        runs.append(run)
    assert best_run(runs, "accuracy", mode="max")["run_id"] == "first", (
        "on a tie the earlier run must win"
    )


def test_hidden_runs_without_metric_are_ignored():
    empty = new_run("empty", {"lr": 0.1})
    scored = new_run("scored", {"lr": 0.2})
    log_metric(scored, "val_loss", 0.7)
    assert best_run([empty, scored], "val_loss", mode="min")["run_id"] == "scored", (
        "runs without the metric must be skipped"
    )


def test_hidden_default_mode_is_min():
    a = new_run("a", {})
    log_metric(a, "val_loss", 0.2)
    b = new_run("b", {})
    log_metric(b, "val_loss", 0.6)
    assert best_run([a, b], "val_loss")["run_id"] == "a", "default mode must be 'min'"


def test_hidden_no_run_has_metric_raises_value_error():
    run = new_run("x", {})
    assert _raises(ValueError, lambda: best_run([run], "val_loss")), (
        "best_run must raise ValueError when no run has the metric"
    )


def test_hidden_unknown_mode_raises_value_error():
    run = new_run("x", {})
    log_metric(run, "val_loss", 0.1)
    assert _raises(ValueError, lambda: best_run([run], "val_loss", mode="avg")), (
        "unknown mode must raise ValueError"
    )


def test_hidden_params_are_copied():
    params = {"lr": 0.01, "seed": 42}
    run = new_run("r", params)
    params["lr"] = 999.0
    assert run["params"]["lr"] == 0.01, "new_run must store a copy of params"


def test_hidden_log_metric_rejects_non_numbers():
    run = new_run("r", {})
    assert _raises(TypeError, lambda: log_metric(run, "loss", "0.5")), (
        "non-numeric metric value must raise TypeError"
    )
    assert _raises(TypeError, lambda: log_metric(run, "loss", True)), (
        "bool metric value must raise TypeError"
    )


def test_hidden_empty_runs_serialize_to_empty_text():
    assert to_jsonl([]) == "", "no runs must give empty text"
    assert from_jsonl("") == [], "empty text must give no runs"


def test_hidden_jsonl_keeps_nested_fields():
    run = new_run("r-9", {"lr": 0.01, "seed": 7}, env={"code_version": "abc"})
    log_artifact(run, "weights.npz")
    for value in (1.0, 0.5):
        log_metric(run, "val_loss", value)
    back = from_jsonl(to_jsonl([run]))
    assert back == [run], "JSON Lines round trip must keep params, env, metrics and artifacts"
