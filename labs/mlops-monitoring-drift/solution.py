"""Drift metrics: reference solution."""

import numpy as np

PSI_EPS = 1e-4


def psi(reference, current, bins=10):
    """Population Stability Index of `current` against `reference`.

    Bin edges are the reference quantiles, so the reference is split into `bins`
    equal-count bins. Values of `current` outside the reference range go to the
    first or last bin, so the shares of `current` always sum to 1. Shares are
    floored at 1e-4 so that empty bins do not give log(0).
    Returns a float.
    """
    reference = np.asarray(reference, dtype=np.float64).ravel()
    current = np.asarray(current, dtype=np.float64).ravel()

    # Interior edges: the k/bins quantiles of the reference, k = 1..bins-1.
    inner = np.quantile(reference, np.linspace(0.0, 1.0, bins + 1))[1:-1]
    # searchsorted(side="right") counts the inner edges <= x, which is the bin index
    # in 0..bins-1. Values below the first edge or above the last one land in the
    # edge bins, so nothing is dropped.
    ref_bin = np.searchsorted(inner, reference, side="right")
    cur_bin = np.searchsorted(inner, current, side="right")
    p = np.bincount(ref_bin, minlength=bins) / reference.size
    q = np.bincount(cur_bin, minlength=bins) / current.size
    p = np.maximum(p, PSI_EPS)
    q = np.maximum(q, PSI_EPS)
    return float(np.sum((p - q) * np.log(p / q)))


def ks_statistic(reference, current):
    """Two-sample Kolmogorov-Smirnov statistic D = sup_x |F_ref(x) - F_cur(x)|.

    Both empirical CDFs are step functions that change only at sample points, so the
    supremum is attained on the union of the two samples. Returns a float in [0, 1].
    """
    a = np.sort(np.asarray(reference, dtype=np.float64).ravel())
    b = np.sort(np.asarray(current, dtype=np.float64).ravel())
    grid = np.concatenate([a, b])
    # side="right" gives F(x) = #{sample <= x} / size, including ties.
    cdf_a = np.searchsorted(a, grid, side="right") / a.size
    cdf_b = np.searchsorted(b, grid, side="right") / b.size
    return float(np.max(np.abs(cdf_a - cdf_b)))
