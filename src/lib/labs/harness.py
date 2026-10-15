"""Lab harness: runs the learner's code, then the tests, and returns a LabResult as JSON.

Loaded by the Pyodide worker (src/lib/labs/worker.ts) via `?raw`. Keep it CPython-compatible
so it can be checked outside the browser. Output format: docs/CONTRACTS.md, LabResult
(src/lib/contracts/lab-result.ts), snake_case keys.
"""

import json
import math
import time
import traceback

SCHEMA_VERSION = 1
MAX_DIFF_CELLS = 50
USER_FILE = "code.py"
VISIBLE_FILE = "tests_visible.py"
HIDDEN_FILE = "tests_hidden.py"


class LabMismatch(AssertionError):
    """Assertion that carries expected/actual values; reported as a test diff."""

    def __init__(self, message, expected=None, actual=None, diff=None):
        super().__init__(message)
        self.expected = expected
        self.actual = actual
        self.diff = diff


def _finite(value):
    """Recursively replaces NaN/inf with None so the result is valid JSON."""
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {k: _finite(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_finite(v) for v in value]
    return value


def _plain(value):
    """Converts numpy values and tuples to plain Python for JSON."""
    if hasattr(value, "tolist"):
        value = value.tolist()
    if isinstance(value, tuple):
        value = list(value)
    if isinstance(value, list):
        return [_plain(v) for v in value]
    return value


class _Report:
    def __init__(self):
        self.metrics = {}
        self.series = {}
        self.arrays = {}


def _helpers(report):
    """Functions injected into the learner's namespace and the test namespace."""

    def report_metric(name, value):
        if isinstance(value, bool) or not isinstance(value, (int, float, str)):
            raise TypeError("report_metric: value must be a number or a string")
        if isinstance(value, float) and not math.isfinite(value):
            raise ValueError(f"report_metric({name!r}): value is NaN or inf")
        report.metrics[name] = value

    def report_series(name, xs, ys, label=None):
        xs = [float(x) for x in xs]
        ys = [float(y) for y in ys]
        if len(xs) != len(ys):
            raise ValueError(f"report_series({name!r}): x and y lengths differ")
        if not all(math.isfinite(v) for v in xs + ys):
            raise ValueError(f"report_series({name!r}): NaN or inf in values")
        entry = {"x": xs, "y": ys}
        if label is not None:
            entry["label"] = str(label)
        report.series[name] = entry

    def report_array(name, value):
        import numpy as np

        arr = np.asarray(value)
        if arr.dtype.kind not in "biuf":
            raise TypeError(f"report_array({name!r}): only real numeric arrays are supported")
        if arr.ndim == 0:
            arr = arr.reshape(1)
        flat = arr.astype(float).ravel().tolist()
        if not all(math.isfinite(v) for v in flat):
            raise ValueError(f"report_array({name!r}): NaN or inf in values")
        report.arrays[name] = {
            "shape": [int(d) for d in arr.shape],
            "dtype": str(arr.dtype),
            "data": flat,
        }

    def assert_close(actual, expected, atol=1e-6, rtol=1e-5, message=None):
        import numpy as np

        a = np.asarray(actual, dtype=float)
        e = np.asarray(expected, dtype=float)
        if a.shape != e.shape:
            raise LabMismatch(
                message or f"shape {a.shape}, expected {e.shape}",
                expected=_plain(e),
                actual=_plain(a),
                diff={"kind": "text", "summary": f"shape {a.shape} != {e.shape}"},
            )
        ok = np.isclose(a, e, atol=atol, rtol=rtol, equal_nan=False)
        if ok.all():
            return
        dev = np.abs(a - e)
        finite_dev = dev[np.isfinite(dev)]
        diff = {"kind": "scalar" if a.ndim == 0 else "array", "summary": ""}
        if finite_dev.size:
            max_abs = float(finite_dev.max())
            diff["max_abs"] = max_abs
            diff["summary"] = f"max deviation {max_abs:.3g}"
        else:
            diff["summary"] = "NaN or inf in actual"
        cells = []
        for idx in np.argwhere(~ok):
            key = tuple(int(i) for i in idx)
            if len(cells) >= MAX_DIFF_CELLS:
                break
            ev = float(e[key])
            av = float(a[key])
            if math.isfinite(ev) and math.isfinite(av):
                cells.append({"index": list(key), "expected": ev, "actual": av})
        if cells:
            diff["cells"] = cells
        raise LabMismatch(
            message or diff["summary"],
            expected=_plain(e),
            actual=_plain(a),
            diff=diff,
        )

    return {
        "report_metric": report_metric,
        "report_series": report_series,
        "report_array": report_array,
        "assert_close": assert_close,
        "LabMismatch": LabMismatch,
    }


def _error(exc, filename):
    """LabError for an exception raised outside the tests."""
    line = None
    if isinstance(exc, SyntaxError) and exc.filename == filename:
        line = exc.lineno
    else:
        for frame in traceback.extract_tb(exc.__traceback__):
            if frame.filename == filename:
                line = frame.lineno
    error = {"type": type(exc).__name__, "message": str(exc) or type(exc).__name__}
    if line:
        error["line"] = int(line)
    return error


def _location(exc, filename):
    line = None
    for frame in traceback.extract_tb(exc.__traceback__):
        if frame.filename == filename:
            line = frame.lineno
    if line is None:
        return None
    return {"file": filename, "line": int(line)}


def _run_tests(ns, filename, hidden):
    tests = [
        (obj.__code__.co_firstlineno, name, obj)
        for name, obj in ns.items()
        if name.startswith("test_")
        and callable(obj)
        and getattr(obj, "__code__", None) is not None
        and obj.__code__.co_filename == filename
    ]
    results = []
    for _, name, fn in sorted(tests, key=lambda t: t[0]):
        entry = {"name": name, "status": "pass", "hidden": hidden}
        exc = None
        try:
            fn()
        except LabMismatch as caught:
            exc = caught
            entry["status"] = "fail"
            if not hidden:
                entry["message"] = str(caught)
                entry["expected"] = caught.expected
                entry["actual"] = caught.actual
                if caught.diff is not None:
                    entry["diff"] = caught.diff
        except AssertionError as caught:
            exc = caught
            entry["status"] = "fail"
            if not hidden:
                entry["message"] = str(caught) or "assertion failed"
        except Exception as caught:  # learner-visible errors inside a test  # noqa: BLE001 - learner-visible errors inside a test
            exc = caught
            entry["status"] = "error"
            if not hidden:
                entry["message"] = f"{type(caught).__name__}: {caught}"
        # Hidden tests report only name and status (contract: no message, no location).
        if exc is not None and not hidden:
            loc = _location(exc, filename)
            if loc is not None:
                entry["location"] = loc
        results.append(entry)
    return results


def run_lab(lab_id, code, visible, hidden):
    """Entry point called from the worker. Always returns a JSON string."""
    started = time.perf_counter()
    report = _Report()
    ns = {"__name__": "__lab__"}
    ns.update(_helpers(report))
    tests = []
    error = None

    try:
        exec(compile(code, USER_FILE, "exec"), ns)  # noqa: S102 - running learner code is the purpose of the harness
    except BaseException as exc:  # noqa: BLE001 - any learner error becomes a result
        error = _error(exc, USER_FILE)

    if error is None:
        for filename, source, is_hidden in (
            (VISIBLE_FILE, visible, False),
            (HIDDEN_FILE, hidden, True),
        ):
            if not source:
                continue
            try:
                exec(compile(source, filename, "exec"), ns)  # noqa: S102 - runs the test file in the learner namespace
            except BaseException as exc:  # noqa: BLE001
                error = _error(exc, filename)
                break
            tests.extend(_run_tests(ns, filename, is_hidden))

    if error is not None:
        status = "error"
    elif any(t["status"] != "pass" for t in tests):
        status = "fail"
    else:
        status = "pass"

    result = {
        "schema_version": SCHEMA_VERSION,
        "lab_id": lab_id,
        "status": status,
        "tests": tests,
        "duration_ms": round((time.perf_counter() - started) * 1000, 3),
        "source": "local",
    }
    if report.metrics:
        result["metrics"] = report.metrics
    if report.series:
        result["series"] = report.series
    if report.arrays:
        result["arrays"] = report.arrays
    if error is not None:
        result["error"] = error
    return json.dumps(_finite(result), allow_nan=False)
