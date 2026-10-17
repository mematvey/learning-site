"""Visible tests: confusion counts, the four metrics and ROC AUC on small cases.

`assert_close` comes from the harness. Labels are 0 or 1.
"""

# ruff: noqa: F821


def test_confusion_counts_order_is_tn_fp_fn_tp():
    y_true = [1, 1, 1, 0, 0, 0, 0, 0, 0]
    y_pred = [1, 1, 0, 1, 1, 0, 0, 0, 0]
    counts = confusion_counts(y_true, y_pred)
    assert counts == (4, 2, 1, 2), f"expected (tn, fp, fn, tp) = (4, 2, 1, 2), got {counts}"


def test_accuracy_precision_recall_f1_hand_case():
    # Same data as above: tp = 2, fp = 2, fn = 1, tn = 4.
    y_true = [1, 1, 1, 0, 0, 0, 0, 0, 0]
    y_pred = [1, 1, 0, 1, 1, 0, 0, 0, 0]
    assert_close(
        accuracy(y_true, y_pred),
        6 / 9,
        atol=1e-9,
        rtol=1e-9,
        message="accuracy must be (tp + tn) / n",
    )
    assert_close(
        precision(y_true, y_pred),
        0.5,
        atol=1e-9,
        rtol=1e-9,
        message="precision must be tp / (tp + fp)",
    )
    assert_close(
        recall(y_true, y_pred), 2 / 3, atol=1e-9, rtol=1e-9, message="recall must be tp / (tp + fn)"
    )
    assert_close(
        f1_score(y_true, y_pred),
        4 / 7,
        atol=1e-9,
        rtol=1e-9,
        message="f1 must be the harmonic mean 2pr / (p + r)",
    )


def test_all_negative_model_on_imbalanced_data():
    # 1 positive out of 100: accuracy looks high, recall and f1 expose the miss.
    y_true = [1] + [0] * 99
    y_pred = [0] * 100
    assert_close(
        accuracy(y_true, y_pred),
        0.99,
        atol=1e-9,
        rtol=1e-9,
        message="accuracy of the all-negative model must be 0.99",
    )
    assert_close(
        recall(y_true, y_pred),
        0.0,
        atol=1e-9,
        rtol=1e-9,
        message="recall must be 0 when no positive is found",
    )
    assert_close(
        f1_score(y_true, y_pred), 0.0, atol=1e-9, rtol=1e-9, message="f1 must be 0 when recall is 0"
    )


def test_roc_auc_hand_case():
    # Positives 0.35 and 0.8 against negatives 0.1 and 0.4: 3 of 4 pairs are ranked correctly.
    y_true = [0, 0, 1, 1]
    scores = [0.1, 0.4, 0.35, 0.8]
    assert_close(
        roc_auc(y_true, scores),
        0.75,
        atol=1e-9,
        rtol=1e-9,
        message="roc_auc must be the fraction of (positive, negative) pairs ranked correctly",
    )


def test_roc_auc_tie_counts_as_half():
    assert_close(
        roc_auc([0, 1], [0.5, 0.5]),
        0.5,
        atol=1e-9,
        rtol=1e-9,
        message="a tied pair must count as one half",
    )


def test_standardize_uses_only_train_statistics():
    # Train column [0, 2] has mean 1 and std 1; the test value 5 must be scaled with them.
    train, test = standardize_with_train_stats([[0.0], [2.0]], [[5.0]])
    assert_close(
        train,
        [[-1.0], [1.0]],
        atol=1e-9,
        rtol=1e-9,
        message="train part must have zero mean and unit std",
    )
    assert_close(
        test,
        [[4.0]],
        atol=1e-9,
        rtol=1e-9,
        message="test part must use the train mean and std, not its own",
    )
