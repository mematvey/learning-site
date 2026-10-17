"""Pipeline planner: starter code.

Complete the functions so that they match the chapter text (section "Код").
A pipeline is a dict {step_name: {"code": str, "params": dict, "deps": [step names]}}.
"""

# Hint: import hashlib and json inside cache_key.


def topo_order(steps):
    """Returns step names so that every step comes after all of its dependencies.

    Among steps that are ready at the same time, the alphabetically smallest goes first.
    Raises ValueError for an unknown dependency or a cycle.
    """
    # TODO: repeat: take the steps whose dependencies are all already placed,
    # append the smallest name, remove it. No ready step but some left -> cycle.
    raise NotImplementedError


def cache_key(code, params, input_keys):
    """Hex digest of the step code, its parameters and the keys of its inputs.

    The order of input_keys and of the parameter names must not matter.
    """
    # TODO: dump {"code", "params", "inputs": sorted(input_keys)} to JSON with sort_keys=True,
    # hash the bytes with sha256 and return the first 16 hex characters
    raise NotImplementedError


def cache_keys(steps):
    """Returns {step_name: key}; the key of a step includes the keys of its dependencies."""
    # TODO: walk the steps in topological order and call cache_key with the keys of the deps
    raise NotImplementedError


def steps_to_run(steps, cached_keys):
    """Names of steps whose key is not in the set `cached_keys`, in topological order."""
    # TODO: compute the keys and keep the steps whose key is missing from cached_keys
    raise NotImplementedError
