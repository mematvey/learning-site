"""Tests for scripts/lab_check.py and the reference lab labs/dl-attention-numpy."""

from __future__ import annotations

import importlib.util
import shutil
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
LAB_ID = "dl-attention-numpy"


def _load_checker():
    spec = importlib.util.spec_from_file_location(
        "lab_check", REPO_ROOT / "scripts" / "lab_check.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


lab_check = _load_checker()


def _copy_lab(tmp_path: Path) -> Path:
    dst = tmp_path / LAB_ID
    shutil.copytree(REPO_ROOT / "labs" / LAB_ID, dst)
    return dst


def _set_timeout(lab_dir: Path, seconds: int) -> None:
    text = (lab_dir / "lab.yaml").read_text(encoding="utf-8")
    (lab_dir / "lab.yaml").write_text(
        text.replace("timeout: 10", f"timeout: {seconds}"), encoding="utf-8"
    )


def test_reference_lab_passes():
    assert lab_check.check_lab(REPO_ROOT / "labs" / LAB_ID) == []


def test_reference_run_reports_every_test():
    cfg = lab_check.load_config(REPO_ROOT / "labs" / LAB_ID)
    result = lab_check.run_impl(REPO_ROOT / "labs" / LAB_ID, cfg, cfg["solution"])
    assert result["status"] == "pass"
    assert len(result["tests"]) == 12
    assert sum(t["hidden"] for t in result["tests"]) == 8
    weights = result["arrays"]["weights"]
    assert weights["shape"] == [4, 4]
    assert len(weights["data"]) == 16


def test_hidden_results_carry_no_messages():
    cfg = lab_check.load_config(REPO_ROOT / "labs" / LAB_ID)
    result = lab_check.run_impl(REPO_ROOT / "labs" / LAB_ID, cfg, cfg["starter"])
    for test in result["tests"]:
        if test["hidden"]:
            assert set(test) == {"name", "status", "hidden"}


def test_wrong_solution_is_reported(tmp_path):
    lab_dir = _copy_lab(tmp_path)
    (lab_dir / "solution.py").write_text(
        "import numpy as np\n\n\ndef attention(Q, K, V, mask=None):\n"
        "    w = np.ones((Q.shape[0], K.shape[0])) / K.shape[0]\n"
        "    return w @ V, w\n",
        encoding="utf-8",
    )
    problems = lab_check.check_lab(lab_dir)
    assert any("reference solution does not pass" in p for p in problems)


def test_passing_starter_is_reported(tmp_path):
    lab_dir = _copy_lab(tmp_path)
    shutil.copy(lab_dir / "solution.py", lab_dir / "starter.py")
    problems = lab_check.check_lab(lab_dir)
    assert problems == ["starter passes all tests (tests do not check the implementation)"]


def test_infinite_loop_becomes_timeout(tmp_path):
    lab_dir = _copy_lab(tmp_path)
    _set_timeout(lab_dir, 2)
    (lab_dir / "starter.py").write_text(
        "def attention(Q, K, V, mask=None):\n    while True:\n        pass\n",
        encoding="utf-8",
    )
    cfg = lab_check.load_config(lab_dir)
    result = lab_check.run_impl(lab_dir, cfg, cfg["starter"])
    assert result["status"] == "timeout"
    assert result["error"]["type"] == "Timeout"
    problems = lab_check.check_lab(lab_dir)
    assert any("starter could not run" in p for p in problems)


def test_id_must_match_folder(tmp_path):
    lab_dir = _copy_lab(tmp_path)
    text = (lab_dir / "lab.yaml").read_text(encoding="utf-8")
    (lab_dir / "lab.yaml").write_text(
        text.replace(f"id: {LAB_ID}", "id: dl-other"), encoding="utf-8"
    )
    problems = lab_check.check_lab(lab_dir)
    assert len(problems) == 1
    assert "must match folder" in problems[0]


def test_disallowed_package_is_rejected(tmp_path):
    lab_dir = _copy_lab(tmp_path)
    text = (lab_dir / "lab.yaml").read_text(encoding="utf-8")
    (lab_dir / "lab.yaml").write_text(
        text.replace("packages: [numpy]", "packages: [torch]"), encoding="utf-8"
    )
    with pytest.raises(lab_check.LabConfigError, match="not allowed"):
        lab_check.load_config(lab_dir)


def test_main_exit_codes(capsys):
    assert lab_check.main([LAB_ID]) == 0
    assert "ok" in capsys.readouterr().out
    assert lab_check.main(["no-such-lab"]) == 1
