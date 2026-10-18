"""Bootstrap standard error, percentile interval and permutation test: starter code.

Complete the three functions. Every random step uses `np.random.default_rng(seed)`,
so results are reproducible. Compare your numbers with the chapter text.
"""

from itertools import combinations  # noqa: F401 - used by the exact enumeration

import numpy as np  # noqa: F401 - used by your implementation


def bootstrap_se(x, n_boot=20000, seed=0):
    """Bootstrap standard error of the sample mean of `x`.

    Draw `n_boot` resamples of `x` with replacement, each of the same size as `x`.
    Return the sample standard deviation (ddof=1) of the resampled means.
    """
    # TODO: resample with replacement, compute the mean of each resample, return the SE
    raise NotImplementedError


def percentile_interval(x, level=0.95, n_boot=20000, seed=0):
    """Percentile bootstrap interval `(lo, hi)` for the mean of `x`.

    Use the bootstrap distribution of the means from `bootstrap_se` and take quantiles
    (1 - level) / 2 and 1 - (1 - level) / 2.
    """
    # TODO: quantiles of the bootstrap means at (1 - level) / 2 and 1 - (1 - level) / 2
    raise NotImplementedError


def permutation_pvalue(a, b, method="exact", n_perm=10000, seed=0):
    """Two-sided permutation p-value for `mean(b) - mean(a)`.

    The statistic is `abs(mean(b) - mean(a))`; under the null hypothesis the group labels
    are exchangeable, so every split of the pooled sample is equally likely.

    method="exact": enumerate all splits of the pooled sample into groups of sizes len(a)
        and len(b), and return the fraction whose statistic is at least the observed one.
    method="mc": draw `n_perm` random permutations of the pooled sample, count those with
        a statistic at least the observed one, and return (1 + count) / (1 + n_perm).
    """
    # TODO: implement both methods; raise ValueError for an unknown method
    raise NotImplementedError
