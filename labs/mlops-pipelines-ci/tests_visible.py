"""Visible tests. The runner executes starter.py (or solution.py) in the same namespace first.

Functions topo_order, cache_key, cache_keys and steps_to_run come from there.
"""

# ruff: noqa: F821


def _pipeline(lr=0.1):
    return {
        "load": {"code": "v1", "params": {}, "deps": []},
        "features": {"code": "v1", "params": {"window": 7}, "deps": ["load"]},
        "train": {"code": "v1", "params": {"lr": lr}, "deps": ["features"]},
        "tests": {"code": "v1", "params": {}, "deps": []},
        "evaluate": {"code": "v1", "params": {}, "deps": ["train"]},
        "deploy": {"code": "v1", "params": {}, "deps": ["evaluate", "tests"]},
    }


def test_topo_order_respects_dependencies():
    order = topo_order(_pipeline())
    assert sorted(order) == sorted(_pipeline()), f"order must contain every step once: {order}"
    pos = {name: i for i, name in enumerate(order)}
    for name, step in _pipeline().items():
        for dep in step["deps"]:
            assert pos[dep] < pos[name], f"{dep} must come before {name}: {order}"


def test_topo_order_smallest_ready_first():
    order = topo_order(_pipeline())
    assert order == ["load", "features", "tests", "train", "evaluate", "deploy"], (
        f"smallest ready step goes first, got {order}"
    )


def test_cache_key_ignores_input_order():
    a = cache_key("v1", {"lr": 0.1, "seed": 1}, ["k1", "k2"])
    b = cache_key("v1", {"seed": 1, "lr": 0.1}, ["k2", "k1"])
    assert a == b, "key must not depend on the order of params or inputs"


def test_cache_key_changes_with_params():
    a = cache_key("v1", {"lr": 0.1}, [])
    b = cache_key("v1", {"lr": 0.2}, [])
    assert a != b, "changing a parameter must change the key"


def test_everything_runs_with_empty_cache():
    assert sorted(steps_to_run(_pipeline(), set())) == sorted(_pipeline()), "empty cache: run all"


def test_nothing_runs_when_all_cached():
    cached = set(cache_keys(_pipeline()).values())
    assert steps_to_run(_pipeline(), cached) == [], "all keys cached: nothing to run"


def test_changing_lr_reruns_train_and_below():
    cached = set(cache_keys(_pipeline(0.1)).values())
    todo = steps_to_run(_pipeline(0.2), cached)
    assert todo == ["train", "evaluate", "deploy"], f"expected train and everything below, got {todo}"
