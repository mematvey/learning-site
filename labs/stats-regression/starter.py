"""Least squares for one feature and a t-based confidence interval for the slope.

Complete the four functions so that they match the chapter text (section "Код").
Use NumPy only. `x` and `y` are 1-D arrays of the same length n >= 3.
"""

import numpy as np  # noqa: F401 - used once you complete the functions


def fit_ols(x, y):
    """Return (intercept, slope) of the least squares line y = intercept + slope * x."""
    # TODO: use the formulas for the slope and the intercept from the chapter
    raise NotImplementedError


def residuals(x, y, intercept, slope):
    """Return the array of residuals y - (intercept + slope * x)."""
    # TODO: subtract the fitted values from y
    raise NotImplementedError


def slope_standard_error(x, y, intercept, slope):
    """Return the standard error of the slope.

    Use s^2 = sum(e^2) / (n - 2) for the residual variance, then
    SE = s / sqrt(sum((x - mean(x))^2)).
    """
    # TODO: estimate sigma from the residuals and divide by the spread of x
    raise NotImplementedError


def slope_confidence_interval(x, y, t_quantile):
    """Return (low, high): the slope estimate +/- t_quantile * standard error.

    `t_quantile` is the t-distribution quantile passed in by the caller.
    """
    # TODO: fit the line, compute the standard error, then build the interval
    raise NotImplementedError
