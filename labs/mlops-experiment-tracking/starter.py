"""Experiment tracker: starter code.

Complete the functions so that they match the chapter text (section "Код").
A run is a plain dict:
    {"run_id": str, "params": dict, "metrics": {name: [value per step]},
     "artifacts": [str], "env": dict}
Runs are stored as JSON Lines: one run per line.
"""


def new_run(run_id, params, env=None):
    """Creates an empty run record.

    params: the values actually used (copied, so later edits do not change the record).
    env: optional environment fields, for example code and data versions.
    """
    # TODO: return a dict with keys run_id (str), params (a deep copy),
    # metrics ({}), artifacts ([]) and env (a deep copy, {} if None)
    raise NotImplementedError


def log_metric(run, name, value):
    """Appends one value to the history of metric `name` (one value per step).

    value: an int or a float (not a bool). Raises TypeError otherwise and
    ValueError if the value is not finite (nan or inf).
    """
    # TODO: check the type of `value` and that it is finite, then append it to run["metrics"][name]
    # (create the list on the first call)
    raise NotImplementedError


def log_artifact(run, path):
    """Adds the path of a file created by the run (for example 'model.npz')."""
    # TODO: append the path to run["artifacts"]
    raise NotImplementedError


def to_jsonl(runs):
    """Serializes runs as JSON Lines: one JSON object per line, newline-terminated."""
    # TODO: one json.dumps(run, sort_keys=True) per run, each followed by "\n"
    raise NotImplementedError


def from_jsonl(text):
    """Parses JSON Lines text back into a list of runs. Empty lines are skipped."""
    # TODO: parse every non-empty line with json.loads
    raise NotImplementedError


def best_run(runs, metric, mode="min"):
    """Returns the run whose FINAL value of `metric` is the best.

    The final value is the last entry of the metric history, not the best step.
    mode "min" picks the smallest value (for example a loss), "max" the largest
    (for example accuracy). Runs without the metric are ignored. On a tie the
    earlier run in `runs` wins. Raises ValueError if the mode is unknown or no
    run has the metric.
    """
    # TODO: check mode; for each run take the last value of the metric history
    # and keep the best one; raise ValueError if no run has the metric
    raise NotImplementedError
