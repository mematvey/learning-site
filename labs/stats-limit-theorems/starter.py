"""Law of large numbers and CLT by simulation: starter code.

Complete the four functions so that they match the chapter text (section "Code").
Each sample mean is an average of n i.i.d. measurements; the standard error is
sigma / sqrt(n). Use `numpy.random.default_rng(seed)` for all randomness.
"""


def sample_means(sampler, n, repeats, seed=0):
    """Simulates `repeats` samples of size `n` and returns their means.

    sampler: callable `sampler(rng, size)` that returns an array of i.i.d. draws
    with the given `size` (a tuple). rng: a `numpy.random.Generator` seeded with `seed`.
    Returns a 1-D array of length `repeats`; element i is the mean of sample i.
    """
    # TODO: create the generator, draw a (repeats, n) array with sampler, average over axis 1
    raise NotImplementedError


def standard_error(sigma, n):
    """Standard error of the mean of n i.i.d. measurements with std `sigma`: sigma / sqrt(n).

    Raise ValueError if n < 1.
    """
    # TODO: check n, then return sigma / sqrt(n)
    raise NotImplementedError


def empirical_standard_error(means):
    """Sample standard deviation of simulated means (ddof=1), an estimate of the standard error."""
    # TODO: standard deviation of the means with one degree of freedom removed
    raise NotImplementedError


def standardized_means(means, mu, sigma, n):
    """CLT normalization Z = (mean - mu) / (sigma / sqrt(n)) for each simulated mean."""
    # TODO: subtract mu, divide by the standard error of a sample of size n
    raise NotImplementedError
