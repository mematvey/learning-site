"""Hidden tests: random data against brute-force references, edge cases and invariances.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def _brute_counts(y_true, y_pred):
    tn = fp = fn = tp = 0
    for t, p in zip(y_true, y_pred):
        if t and p:
            tp += 1
        elif t:
            fn += 1
        elif p:
            fp += 1
        else:
            tn += 1
    return (tn, fp, fn, tp)


def _brute_auc(y_true, scores):
    pos = [s for s, t in zip(scores, y_true) if t]
    neg = [s for s, t in zip(scores, y_true) if not t]
    total = 0.0
    for p in pos:
        for q in neg:
            total += 1.0 if p > q else (0.5 if p == q else 0.0)
    return total / (len(pos) * len(neg))


def test_hidden_random_counts_match_brute_force():
    rng = np.random.default_rng(0)
    y_true = rng.integers(0, 2, size=60)
    y_pred = rng.integers(0, 2, size=60)
    assert_close(
        np.asarray(confusion_counts(y_true, y_pred), dtype=float),
        np.asarray(_brute_counts(y_true, y_pred), dtype=float),
        atol=0,
        rtol=0,
        message="mismatch on random input, seed 0",
    )


def test_hidden_bool_inputs_same_as_int():
    y_true = np.array([1, 0, 1, 1, 0])
    y_pred = np.array([1, 1, 0, 1, 0])
    assert_close(
        accuracy(y_true.astype(bool), y_pred.astype(bool)),
        accuracy(y_true, y_pred),
        atol=1e-12,
        rtol=0,
        message="boolean labels must give the same metrics as 0/1 labels",
    )


def test_hidden_no_positive_predictions_gives_zero_precision():
    y_true = [1, 0, 1, 0]
    y_pred = [0, 0, 0, 0]
    value = precision(y_true, y_pred)
    assert np.isfinite(value) and value == 0.0, "precision with no predicted positives must be 0.0"


def test_hidden_perfect_model_scores_one():
    y = [0, 1, 1, 0, 1]
    assert_close(
        [accuracy(y, y), precision(y, y), recall(y, y), f1_score(y, y)],
        [1.0, 1.0, 1.0, 1.0],
        atol=1e-12,
        rtol=0,
        message="a perfect model must score 1 on every metric",
    )


def test_hidden_random_roc_auc_matches_brute_force_with_ties():
    rng = np.random.default_rng(1)
    y_true = rng.integers(0, 2, size=200)
    # Rounded scores create many ties on purpose.
    scores = np.round(rng.normal(size=200), 1)
    assert_close(
        roc_auc(y_true, scores),
        _brute_auc(y_true, scores),
        atol=1e-9,
        rtol=1e-9,
        message="mismatch on random input with ties, seed 1",
    )


def test_hidden_roc_auc_monotone_invariant():
    rng = np.random.default_rng(2)
    y_true = rng.integers(0, 2, size=80)
    scores = rng.normal(size=80)
    base = roc_auc(y_true, scores)
    assert_close(
        roc_auc(y_true, np.exp(3.0 * scores) + 7.0),
        base,
        atol=1e-12,
        rtol=0,
        message="roc_auc must depend only on the order of the scores",
    )


def test_hidden_roc_auc_perfect_and_reversed():
    y = [0, 0, 1, 1]
    assert_close(
        roc_auc(y, [0.1, 0.2, 0.8, 0.9]),
        1.0,
        atol=1e-12,
        rtol=0,
        message="perfect ranking must give 1.0",
    )
    assert_close(
        roc_auc(y, [0.9, 0.8, 0.2, 0.1]),
        0.0,
        atol=1e-12,
        rtol=0,
        message="fully reversed ranking must give 0.0",
    )


def test_hidden_roc_auc_needs_both_classes():
    try:
        roc_auc([1, 1, 1], [0.1, 0.2, 0.3])
    except ValueError:
        return
    raise AssertionError("roc_auc must raise ValueError when one class is missing")


def test_hidden_shape_mismatch_raises():
    try:
        confusion_counts([1, 0, 1], [1, 0])
    except ValueError:
        return
    raise AssertionError("confusion_counts must raise ValueError on different lengths")
