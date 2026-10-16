"""Classification metrics: starter code.

Complete the functions so that they match the chapter text.
Conventions: labels are 0 or 1; scores are real numbers, higher means "more positive".
"""


def confusion_counts(y_true, y_pred):
    """Counts of the confusion matrix as a tuple (tn, fp, fn, tp).

    Raises ValueError if y_true and y_pred have different shapes.
    """
    # TODO: count true negatives, false positives, false negatives and true positives
    raise NotImplementedError


def accuracy(y_true, y_pred):
    """Fraction of correct answers: (tp + tn) / n."""
    # TODO: use the four counts from confusion_counts
    raise NotImplementedError


def precision(y_true, y_pred):
    """tp / (tp + fp). Returns 0.0 when the model predicts no positives."""
    # TODO: guard against a zero denominator
    raise NotImplementedError


def recall(y_true, y_pred):
    """tp / (tp + fn). Returns 0.0 when there are no positive objects."""
    # TODO: guard against a zero denominator
    raise NotImplementedError


def f1_score(y_true, y_pred):
    """Harmonic mean of precision and recall. Returns 0.0 when both are 0."""
    # TODO: combine precision and recall as in the chapter formula
    raise NotImplementedError


def roc_auc(y_true, scores):
    """Probability that a random positive scores above a random negative; ties count as 1/2.

    Raises ValueError if there is no positive or no negative object.
    Only the order of the scores matters, so a monotone transform does not change the result.
    """
    # TODO: compare every positive score with every negative score
    # TODO: count ties as one half
    raise NotImplementedError
