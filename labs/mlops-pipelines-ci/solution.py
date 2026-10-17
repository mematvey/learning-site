"""Pipeline planner: reference solution.

A pipeline is a dict {step_name: {"code": str, "params": dict, "deps": [step names]}}.
"""

import hashlib
import json


def topo_order(steps):
    """Returns step names so that every step comes after all of its dependencies.

    Among steps that are ready at the same time, the alphabetically smallest goes first.
    Raises ValueError for an unknown dependency or a cycle.
    """
    for name, step in steps.items():
        for dep in step["deps"]:
            if dep not in steps:
                raise ValueError(f"step {name!r} depends on unknown step {dep!r}")
    remaining = {name: set(step["deps"]) for name, step in steps.items()}
    order = []
    while remaining:
        ready = sorted(name for name, deps in remaining.items() if not deps)
        if not ready:
            raise ValueError("dependency cycle")
        name = ready[0]
        order.append(name)
        del remaining[name]
        for deps in remaining.values():
            deps.discard(name)
    return order


def cache_key(code, params, input_keys):
    """Hex digest of the step code, its parameters and the keys of its inputs.

    The order of input_keys and of the parameter names must not matter.
    """
    payload = json.dumps(
        {"code": code, "params": params, "inputs": sorted(input_keys)},
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


def cache_keys(steps):
    """Returns {step_name: key}; the key of a step includes the keys of its dependencies."""
    keys = {}
    for name in topo_order(steps):
        step = steps[name]
        keys[name] = cache_key(step["code"], step["params"], [keys[d] for d in step["deps"]])
    return keys


def steps_to_run(steps, cached_keys):
    """Names of steps whose key is not in the set `cached_keys`, in topological order."""
    keys = cache_keys(steps)
    return [name for name in topo_order(steps) if keys[name] not in cached_keys]
