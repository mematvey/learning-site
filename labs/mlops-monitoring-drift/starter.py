"""Drift metrics: starter code.

Complete `psi` and `ks_statistic` so that they match the chapter text. Both take
1-D real samples: `reference` is the training-time sample, `current` the production one.
"""

import numpy as np

PSI_EPS = 1e-4


def psi(reference, current, bins=10):
    """Population Stability Index of `current` against `reference`.

    Bin edges are the reference quantiles (`bins` bins). Values of `current` outside
    the reference range must still be counted, in the first or last bin. Shares are
    floored at 1e-4 so that empty bins do not give log(0). Returns a float.
    """
    reference = np.asarray(reference, dtype=np.float64).ravel()
    current = np.asarray(current, dtype=np.float64).ravel()

    # TODO: place the interior reference quantile edges (bins - 1 values)
    # TODO: assign every value of both samples to a bin
    # TODO: turn counts into shares, floor them at PSI_EPS, return sum((p - q) * ln(p / q))
    raise NotImplementedError


def ks_statistic(reference, current):
    """Two-sample Kolmogorov-Smirnov statistic D = sup_x |F_ref(x) - F_cur(x)|.

    F is the empirical CDF of each sample. Returns a float in [0, 1].
    """
    reference = np.asarray(reference, dtype=np.float64).ravel()
    current = np.asarray(current, dtype=np.float64).ravel()

    # TODO: evaluate both empirical CDFs on the union of the two samples
    raise NotImplementedError
