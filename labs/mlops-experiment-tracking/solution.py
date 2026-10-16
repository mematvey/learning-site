"""Experiment tracker: reference solution.

A run is a plain dict:
    {"run_id": str, "params": dict, "metrics": {name: [value per step]},
     "artifacts": [str], "env": dict}
Runs are stored as JSON Lines: one run per line.
"""

import copy
import json
import math


def new_run(run_id, params, env=None):
    """Creates an empty run record.

    params: the values actually used (copied, so later edits do not change the record).
    env: optional environment fields, for example code and data versions.
    """
    return {
        "run_id": str(run_id),
        "params": copy.deepcopy(dict(params)),
        "metrics": {},
        "artifacts": [],
        "env": copy.deepcopy(dict(env or {})),
    }


def log_metric(run, name, value):
    """Appends one value to the history of metric `name` (one value per step).

    value: an int or a float (not a bool). Raises TypeError otherwise and
    ValueError if the value is not finite (nan or inf).
    """
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError(f"metric value must be a number, got {value!r}")
    if not math.isfinite(value):
        raise ValueError(f"metric value must be finite, got {value!r}")
    run["metrics"].setdefault(name, []).append(float(value))


def log_artifact(run, path):
    """Adds the path of a file created by the run (for example 'model.npz')."""
    run["artifacts"].append(str(path))


def to_jsonl(runs):
    """Serializes runs as JSON Lines: one JSON object per line, newline-terminated."""
    return "".join(json.dumps(run, sort_keys=True) + "\n" for run in runs)


def from_jsonl(text):
    """Parses JSON Lines text back into a list of runs. Empty lines are skipped."""
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def _is_better(value, reference, mode):
    """True if `value` strictly beats `reference` for the given mode."""
    return value < reference if mode == "min" else value > reference


def best_run(runs, metric, mode="min"):
    """Returns the run whose FINAL value of `metric` is the best.

    The final value is the last entry of the metric history, not the best step.
    mode "min" picks the smallest value (for example a loss), "max" the largest
    (for example accuracy). Runs without the metric are ignored. On a tie the
    earlier run in `runs` wins. Raises ValueError if the mode is unknown or no
    run has the metric.
    """
    if mode not in ("min", "max"):
        raise ValueError(f"mode must be 'min' or 'max', got {mode!r}")
    best = None
    best_value = None
    for run in runs:
        history = run["metrics"].get(metric)
        if not history:
            continue
        value = history[-1]
        if best_value is None or _is_better(value, best_value, mode):
            best, best_value = run, value
    if best is None:
        raise ValueError(f"no run has metric {metric!r}")
    return best
