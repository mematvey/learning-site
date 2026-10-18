"""Visible tests. `gradient`, `gradient_descent` and `assert_close` come from the runner.

The runner executes starter.py (or solution.py) in the same namespace first.
"""

# ruff: noqa: F821
import numpy as np

# Data from the chapter: y = 2x + 1 exactly, so the least squares solution is w = 2, b = 1.
X = np.array([[0.0], [1.0], [2.0]])
y = np.array([1.0, 3.0, 5.0])


def test_gradient_shapes():
    grad_w, grad_b = gradient(X, y, np.zeros(1), 0.0)
    assert np.shape(grad_w) == (1,), f"expected grad_w shape (1,), got {np.shape(grad_w)}"
    assert np.shape(grad_b) == (), f"expected scalar grad_b, got shape {np.shape(grad_b)}"


def test_gradient_at_zero_by_hand():
    # At w = 0, b = 0: err = -y = (-1, -3, -5); grad_w = 2/3 * (0*-1 + 1*-3 + 2*-5) = -26/3;
    # grad_b = 2/3 * (-9) = -6.
    grad_w, grad_b = gradient(X, y, np.zeros(1), 0.0)
    assert_close(
        grad_w,
        [-26.0 / 3.0],
        atol=1e-9,
        message=f"expected grad_w [-8.6667], got {grad_w.tolist()}",
    )
    assert_close(grad_b, -6.0, atol=1e-9, message=f"expected grad_b -6, got {grad_b}")


def test_one_step_by_hand():
    # One step with lr = 0.1 from zero: w = 0.8667, b = 0.6.
    w, b = gradient_descent(X, y, lr=0.1, steps=1)
    assert_close(
        w, [0.8666667], atol=1e-6, message=f"expected w [0.8667], got {np.round(w, 4).tolist()}"
    )
    assert_close(b, 0.6, atol=1e-6, message=f"expected b 0.6, got {b}")


def test_converges_to_least_squares():
    w, b = gradient_descent(X, y, lr=0.1, steps=1000)
    assert_close(
        w, [2.0], atol=1e-4, message=f"expected w close to [2], got {np.round(w, 5).tolist()}"
    )
    assert_close(b, 1.0, atol=1e-4, message=f"expected b close to 1, got {round(float(b), 5)}")
