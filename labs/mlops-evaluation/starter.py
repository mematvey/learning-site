"""Bootstrap intervals: starter code.

Implement the three functions. `correct` arguments are 1-D arrays of 0/1 flags, one per
example: 1 if the model answered the example correctly. Both models in a comparison are
evaluated on the same examples, so their arrays have the same length.
"""


def accuracy_ci(correct, n_boot=2000, seed=0, level=0.95):
    """Percentile bootstrap interval for the accuracy of one model.

    Resample the examples with replacement `n_boot` times with
    `np.random.default_rng(seed)`, take the accuracy of each resample, and return
    the central `level` interval of these accuracies as (low, high).
    """
    # TODO: draw the resampled example indices, compute the accuracy of each resample
    # TODO: return the lower and upper percentile for (1 - level) / 2 and 1 - (1 - level) / 2
    raise NotImplementedError


def paired_diff_ci(correct_a, correct_b, n_boot=2000, seed=0, level=0.95):
    """Paired bootstrap interval for accuracy(A) - accuracy(B).

    Each resample draws example indices once and uses them for both models, so every
    example keeps its pair of answers. Returns (low, high).
    """
    # TODO: draw one set of indices per resample and use it for both models
    raise NotImplementedError


def unpaired_diff_ci(correct_a, correct_b, n_boot=2000, seed=0, level=0.95):
    """Unpaired bootstrap interval for accuracy(A) - accuracy(B).

    Resample each model on its own, as if the two were independent samples.
    Returns (low, high).
    """
    # TODO: draw separate indices for A and for B, then take the difference of accuracies
    raise NotImplementedError
