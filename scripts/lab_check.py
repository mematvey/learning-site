"""Checks reference labs: the solution must pass all tests, the starter must fail at least one.

Usage: uv run python scripts/lab_check.py [lab-id]
Without an argument every lab in labs/ is checked. Exit code 0 means all labs pass.

Each run executes in a separate isolated Python process with the lab timeout, so an
infinite loop in learner code becomes a `timeout` status instead of a hang.
"""

from __future__ import annotations

import io
import json
import re
import subprocess
import sys
import time
import traceback
from contextlib import redirect_stdout
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_VERSION = 1
ALLOWED_PACKAGES = {"numpy"}
LAB_ID_RE = re.compile(r"^[a-z][a-z0-9]*(-[a-z0-9]+)+$")
CHAPTER_ID_RE = re.compile(r"^[a-z][a-z0-9]*(-[a-z0-9]+)*/[a-z][a-z0-9]*(-[a-z0-9]+)*$")
DEFAULT_TIMEOUT_S = 10


class LabConfigError(Exception):
    """The lab folder or lab.yaml is malformed."""


def load_config(lab_dir: Path) -> dict:
    """Reads and validates lab.yaml. Returns the parsed mapping."""
    yaml_path = lab_dir / "lab.yaml"
    if not yaml_path.is_file():
        raise LabConfigError(f"{yaml_path}: missing lab.yaml")
    cfg = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
    if not isinstance(cfg, dict):
        raise LabConfigError(f"{yaml_path}: expected a mapping")

    lab_id = cfg.get("id")
    if lab_id != lab_dir.name:
        raise LabConfigError(f"{yaml_path}: id {lab_id!r} must match folder {lab_dir.name!r}")
    if not isinstance(lab_id, str) or not LAB_ID_RE.match(lab_id):
        raise LabConfigError(f"{yaml_path}: id must be <topic>-<slug>")
    chapter = cfg.get("chapter")
    if not isinstance(chapter, str) or not CHAPTER_ID_RE.match(chapter):
        raise LabConfigError(f"{yaml_path}: chapter must be <topic>/<slug>")
    if cfg.get("runtime") != "pyodide":
        raise LabConfigError(f"{yaml_path}: runtime must be 'pyodide' for this checker")
    for key in ("starter", "solution"):
        if not isinstance(cfg.get(key), str):
            raise LabConfigError(f"{yaml_path}: missing `{key}`")
    tests = cfg.get("tests")
    if not isinstance(tests, dict) or not isinstance(tests.get("visible"), str):
        raise LabConfigError(f"{yaml_path}: missing `tests.visible`")
    timeout = cfg.get("timeout", DEFAULT_TIMEOUT_S)
    if not isinstance(timeout, (int, float)) or timeout <= 0:
        raise LabConfigError(f"{yaml_path}: timeout must be a positive number")
    packages = cfg.get("packages", [])
    unknown = set(packages) - ALLOWED_PACKAGES
    if unknown:
        raise LabConfigError(f"{yaml_path}: packages not allowed: {sorted(unknown)}")
    files = [cfg["starter"], cfg["solution"], tests["visible"]]
    files += [tests["hidden"]] if "hidden" in tests else []
    for name in files:
        if not (lab_dir / name).is_file():
            raise LabConfigError(f"{yaml_path}: file not found: {name}")
    return cfg


def run_impl(lab_dir: Path, cfg: dict, impl_name: str) -> dict:
    """Runs one implementation file against the lab tests in a subprocess.

    Returns a LabResult-like dict (snake_case keys, schema_version 1).
    """
    lab_dir = lab_dir.resolve()
    timeout = float(cfg.get("timeout", DEFAULT_TIMEOUT_S))
    started = time.perf_counter()
    base = {
        "schema_version": SCHEMA_VERSION,
        "lab_id": cfg["id"],
        "source": "local",
    }
    try:
        proc = subprocess.run(
            [sys.executable, "-I", str(Path(__file__).resolve()), "--worker",
             str(lab_dir), impl_name],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=timeout,
            cwd=str(lab_dir),
        )
    except subprocess.TimeoutExpired:
        elapsed = round((time.perf_counter() - started) * 1000)
        return {
            **base,
            "status": "timeout",
            "tests": [],
            "duration_ms": elapsed,
            "error": {"type": "Timeout", "message": f"exceeded {timeout:g} s"},
        }
    elapsed = round((time.perf_counter() - started) * 1000)
    if proc.returncode != 0:
        return {
            **base,
            "status": "error",
            "tests": [],
            "duration_ms": elapsed,
            "stderr": proc.stderr,
            "error": {"type": "WorkerCrash", "message": proc.stderr.strip()[-500:]},
        }
    payload = json.loads(proc.stdout)
    tests = payload["tests"]
    status = "pass" if all(t["status"] == "pass" for t in tests) else "fail"
    result = {**base, "status": status, "tests": tests, "duration_ms": elapsed}
    if payload.get("arrays"):
        result["arrays"] = payload["arrays"]
    if payload.get("stdout"):
        result["stdout"] = payload["stdout"]
    return result


# ---------------------------------------------------------------------------
# Worker: runs inside a separate isolated process.
# ---------------------------------------------------------------------------


def _worker(lab_dir: Path, impl_name: str) -> None:
    cfg = load_config(lab_dir)
    tests_files = [cfg["tests"]["visible"]]
    if "hidden" in cfg["tests"]:
        tests_files.append(cfg["tests"]["hidden"])

    arrays: dict[str, dict] = {}

    def report_array(name: str, values) -> None:
        import numpy as np

        arr = np.asarray(values)
        arrays[name] = {
            "shape": list(arr.shape),
            "dtype": str(arr.dtype),
            "data": [float(x) for x in arr.reshape(-1)],
        }

    namespace: dict = {"__name__": "__lab__", "report_array": report_array}
    captured = io.StringIO()
    tests: list[dict] = []
    with redirect_stdout(captured):
        _exec_file(lab_dir / impl_name, namespace)
        for tests_name in tests_files:
            hidden = tests_name == cfg["tests"].get("hidden")
            fn_names = _exec_file(lab_dir / tests_name, namespace)
            for fn_name in fn_names:
                tests.append(_run_test(namespace[fn_name], fn_name, hidden, lab_dir))

    out = {"tests": tests, "arrays": arrays, "stdout": captured.getvalue()}
    sys.stdout.write(json.dumps(out))


def _exec_file(path: Path, namespace: dict) -> list[str]:
    """Executes a file in the shared namespace; returns names of test_* functions it defines."""
    source = path.read_text(encoding="utf-8")
    code = compile(source, path.name, "exec")
    exec(code, namespace)  # noqa: S102 - lab code runs by design, in a child process
    names = []
    for name, value in namespace.items():
        code = getattr(value, "__code__", None)
        if name.startswith("test_") and code is not None and code.co_filename == path.name:
            names.append(name)
    return names


def _run_test(fn, name: str, hidden: bool, lab_dir: Path) -> dict:
    try:
        fn()
    except AssertionError as exc:
        entry = {"name": name, "status": "fail", "hidden": hidden}
        if not hidden:
            entry["message"] = str(exc) or "assertion failed"
            loc = _location(exc)
            if loc:
                entry["location"] = loc
        return entry
    except Exception as exc:  # noqa: BLE001 - any error raised by learner code is a result
        entry = {"name": name, "status": "error", "hidden": hidden}
        if not hidden:
            entry["message"] = f"{type(exc).__name__}: {exc}"
            loc = _location(exc)
            if loc:
                entry["location"] = loc
        return entry
    return {"name": name, "status": "pass", "hidden": hidden}


def _location(exc: BaseException) -> dict | None:
    """Last traceback frame inside a lab file (learner code or test file)."""
    frames = traceback.extract_tb(exc.__traceback__)
    for frame in reversed(frames):
        name = Path(frame.filename).name
        if name in {"starter.py", "solution.py", "tests_visible.py", "tests_hidden.py"}:
            return {"file": name, "line": frame.lineno}
    return None


# ---------------------------------------------------------------------------
# Checks.
# ---------------------------------------------------------------------------


def check_lab(lab_dir: Path) -> list[str]:
    """Returns a list of problems for one lab. Empty list means the lab is good."""
    try:
        cfg = load_config(lab_dir)
    except LabConfigError as exc:
        return [str(exc)]

    problems: list[str] = []
    ref_a = run_impl(lab_dir, cfg, cfg["solution"])
    if ref_a["status"] != "pass":
        problems.append(_summary("reference solution does not pass", ref_a))
    ref_b = run_impl(lab_dir, cfg, cfg["solution"])
    if _signature(ref_a) != _signature(ref_b):
        problems.append("reference run is not deterministic (names/statuses differ between runs)")

    start = run_impl(lab_dir, cfg, cfg["starter"])
    if start["status"] == "pass":
        problems.append("starter passes all tests (tests do not check the implementation)")
    elif start["status"] in ("timeout", "error") and not start["tests"]:
        problems.append(_summary("starter could not run", start))
    return problems


def _signature(result: dict) -> list[tuple[str, str]]:
    return [(t["name"], t["status"]) for t in result["tests"]]


def _summary(prefix: str, result: dict) -> str:
    failed = [t["name"] for t in result["tests"] if t["status"] != "pass"]
    detail = f"status={result['status']}"
    if failed:
        detail += f", failing: {', '.join(failed)}"
    if result.get("error"):
        detail += f", error: {result['error']['type']}: {result['error']['message']}"
    return f"{prefix} ({detail})"


def main(argv: list[str]) -> int:
    labs_root = REPO_ROOT / "labs"
    if argv:
        lab_dirs = [labs_root / argv[0]]
    else:
        lab_dirs = sorted(p.parent for p in labs_root.glob("*/lab.yaml"))
    if not lab_dirs:
        print("lab-check: no labs found")
        return 1

    exit_code = 0
    for lab_dir in lab_dirs:
        if not lab_dir.is_dir():
            print(f"{lab_dir.name}: not found")
            exit_code = 1
            continue
        problems = check_lab(lab_dir)
        if problems:
            exit_code = 1
            for problem in problems:
                print(f"{lab_dir.name}: FAIL {problem}")
        else:
            print(f"{lab_dir.name}: ok (reference passes, starter fails)")
    return exit_code


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "--worker":
        _worker(Path(sys.argv[2]), sys.argv[3])
    else:
        sys.exit(main(sys.argv[1:]))
