"""Visible tests. The runner executes starter.py (or solution.py) in the same namespace first.

Functions new_run, log_metric, log_artifact, to_jsonl, from_jsonl and best_run come from there.
"""

# ruff: noqa: F821


def _make_run(run_id, final_loss):
    run = new_run(run_id, {"lr": 0.01, "seed": 42})
    log_metric(run, "val_loss", final_loss)
    return run


def test_new_run_has_required_fields():
    run = new_run(
        "r-007",
        {"lr": 0.01, "batch_size": 64, "seed": 42},
        env={"code_version": "a1b2c3d", "data_version": "v3"},
    )
    assert run["run_id"] == "r-007", f"expected run_id 'r-007', got {run['run_id']!r}"
    assert run["params"] == {"lr": 0.01, "batch_size": 64, "seed": 42}, (
        f"params differ: {run['params']!r}"
    )
    assert run["metrics"] == {}, f"expected empty metrics, got {run['metrics']!r}"
    assert run["artifacts"] == [], f"expected no artifacts, got {run['artifacts']!r}"
    assert run["env"] == {"code_version": "a1b2c3d", "data_version": "v3"}, (
        f"env differs: {run['env']!r}"
    )


def test_log_metric_keeps_history_by_step():
    run = new_run("r-001", {"lr": 0.1})
    for value in (0.92, 0.61, 0.48):
        log_metric(run, "val_loss", value)
    expected = [0.92, 0.61, 0.48]
    assert run["metrics"]["val_loss"] == expected, (
        f"expected history {expected}, got {run['metrics']['val_loss']!r}"
    )


def test_log_artifact_appends_path():
    run = new_run("r-001", {"lr": 0.1})
    log_artifact(run, "model.npz")
    assert run["artifacts"] == ["model.npz"], f"expected ['model.npz'], got {run['artifacts']!r}"


def test_jsonl_round_trip_one_line_per_run():
    runs = [_make_run("r-001", 0.5), _make_run("r-002", 0.4)]
    text = to_jsonl(runs)
    lines = [line for line in text.splitlines() if line.strip()]
    assert len(lines) == 2, f"expected 2 lines (one per run), got {len(lines)}"
    back = from_jsonl(text)
    assert back == runs, f"round trip changed the runs: {back!r}"


def test_best_run_min_picks_lowest_final_loss():
    runs = [_make_run("r-001", 0.48), _make_run("r-002", 0.30), _make_run("r-003", 0.55)]
    best = best_run(runs, "val_loss", mode="min")
    assert best["run_id"] == "r-002", f"expected run 'r-002' (lowest loss), got {best['run_id']!r}"


def test_best_run_max_picks_highest_accuracy():
    runs = []
    for run_id, acc in (("r-001", 0.81), ("r-002", 0.93), ("r-003", 0.90)):
        run = new_run(run_id, {"lr": 0.1})
        log_metric(run, "accuracy", acc)
        runs.append(run)
    best = best_run(runs, "accuracy", mode="max")
    assert best["run_id"] == "r-002", (
        f"expected run 'r-002' (highest accuracy), got {best['run_id']!r}"
    )
