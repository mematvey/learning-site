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


def _step(deps=(), code="v1", params=None):
    return {"code": code, "params": params or {}, "deps": list(deps)}


def test_hidden_cycle_raises():
    steps = {"a": _step(["b"]), "b": _step(["a"])}
    assert _raises(ValueError, lambda: topo_order(steps)), "cycle must raise ValueError"


def test_hidden_unknown_dependency_raises():
    steps = {"a": _step(["ghost"])}
    assert _raises(ValueError, lambda: topo_order(steps)), "unknown dependency must raise"


def test_hidden_exact_order_with_ties():
    steps = {
        "d": _step(["b", "c"]),
        "c": _step(["a"]),
        "b": _step(["a"]),
        "a": _step(),
        "z": _step(),
    }
    assert topo_order(steps) == ["a", "b", "c", "d", "z"], "alphabetical among ready steps"


def test_hidden_code_change_propagates_down_only():
    base = {
        "a": _step(),
        "b": _step(["a"]),
        "c": _step(["b"]),
        "side": _step(["a"]),
    }
    cached = set(cache_keys(base).values())
    edited = {**base, "b": _step(["a"], code="v2")}
    assert steps_to_run(edited, cached) == ["b", "c"], "side branch and a stay cached"


def test_hidden_upstream_change_changes_downstream_keys():
    one = {"a": _step(code="v1"), "b": _step(["a"])}
    two = {"a": _step(code="v2"), "b": _step(["a"])}
    assert cache_keys(one)["b"] != cache_keys(two)["b"], "key of b must include the key of a"


def test_hidden_key_does_not_depend_on_step_name():
    k1 = cache_key("v1", {"x": 1}, [])
    steps = {"anything": _step(params={"x": 1})}
    assert cache_keys(steps)["anything"] == k1, "key does not depend on the step name"


def test_hidden_dependency_order_does_not_matter():
    s1 = {"a": _step(), "b": _step(), "c": _step(["a", "b"])}
    s2 = {"a": _step(), "b": _step(), "c": _step(["b", "a"])}
    assert cache_keys(s1)["c"] == cache_keys(s2)["c"], "order of deps must not change the key"
