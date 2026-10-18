"""Least squares for one feature and a t-based confidence interval for the slope: reference solution."""

import numpy as np


def fit_ols(x, y):
    """Return (intercept, slope) of the least squares line y = intercept + slope * x."""
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    x_mean = x.mean()
    y_mean = y.mean()
    sxx = np.sum((x - x_mean) ** 2)
    sxy = np.sum((x - x_mean) * (y - y_mean))
    slope = sxy / sxx
    intercept = y_mean - slope * x_mean
    return float(intercept), float(slope)


def residuals(x, y, intercept, slope):
    """Return the array of residuals y - (intercept + slope * x)."""
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    return y - (intercept + slope * x)


def slope_standard_error(x, y, intercept, slope):
    """Return the standard error of the slope."""
    x = np.asarray(x, dtype=np.float64)
    n = x.size
    e = residuals(x, y, intercept, slope)
    # Two estimated quantities (intercept and slope) cost two degrees of freedom.
    sigma2 = np.sum(e**2) / (n - 2)
    sxx = np.sum((x - x.mean()) ** 2)
    return float(np.sqrt(sigma2 / sxx))


def slope_confidence_interval(x, y, t_quantile):
    """Return (low, high): the slope estimate +/- t_quantile * standard error."""
    intercept, slope = fit_ols(x, y)
    se = slope_standard_error(x, y, intercept, slope)
    half_width = t_quantile * se
    return float(slope - half_width), float(slope + half_width)
