"""Visible tests. `accuracy_ci`, `paired_diff_ci`, `unpaired_diff_ci` and `assert_close`
come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np


def example_flags():
    """100 examples: model A is right on 80, model B on 76, they differ on 10 of them."""
    a = np.array([1] * 73 + [1] * 7 + [0] * 3 + [0] * 17, dtype=float)
    b = np.array([1] * 73 + [0] * 7 + [1] * 3 + [0] * 17, dtype=float)
    return a, b


def test_accuracy_ci_contains_point_estimate():
    a, _ = example_flags()
    low, high = accuracy_ci(a)
    assert low <= 0.80 <= high, f"interval {low:.3f}..{high:.3f} must contain accuracy 0.80"


def test_accuracy_ci_all_correct_is_degenerate():
    low, high = accuracy_ci(np.ones(50))
    assert_close(
        [low, high], [1.0, 1.0], atol=1e-12, message=f"all-correct sample: got {low}..{high}"
    )


def test_accuracy_ci_narrows_with_more_examples():
    rng = np.random.default_rng(10)
    small = (rng.random(100) < 0.8).astype(float)
    large = (rng.random(400) < 0.8).astype(float)
    w_small = accuracy_ci(small)[1] - accuracy_ci(small)[0]
    w_large = accuracy_ci(large)[1] - accuracy_ci(large)[0]
    assert w_large < w_small, (
        f"width with 400 examples ({w_large:.3f}) must be below 100 ({w_small:.3f})"
    )


def test_paired_interval_for_example_includes_zero():
    # Expected from the chapter: about -0.02 .. +0.10 (the chapter's normal estimate).
    # The bootstrap percentile on this discrete sample gives about -0.02 .. +0.11.
    a, b = example_flags()
    low, high = paired_diff_ci(a, b)
    assert_close(low, -0.02, atol=0.005, message=f"expected low bound -0.02, got {low:.4f}")
    assert_close(high, 0.11, atol=0.005, message=f"expected high bound 0.11, got {high:.4f}")
    assert low < 0.0 < high, "the paired interval for this example must include zero"


def test_paired_interval_is_narrower_than_unpaired():
    a, b = example_flags()
    p_low, p_high = paired_diff_ci(a, b)
    u_low, u_high = unpaired_diff_ci(a, b)
    assert p_high - p_low < u_high - u_low, (
        f"paired width {p_high - p_low:.3f} must be below unpaired {u_high - u_low:.3f}"
    )
