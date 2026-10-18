"""kNN classification with uniform or distance-weighted voting, and linear SVM margin: reference solution."""

import numpy as np


def knn_predict(X_train, y_train, X_test, k=3, weights="uniform"):
    """Predict a class for each row of X_test by voting among k nearest training rows.

    X_train: array (n, d) of training features; y_train: array (n,) of labels.
    X_test: array (m, d). Returns an array (m,) with the label of each test row.

    weights="uniform": every neighbour has vote 1.
    weights="distance": a neighbour votes 1 / distance. If some neighbour
    coincides with the test row (distance 0), only the coinciding neighbours vote.
    Ties in votes are broken by the smaller label.
    """
    if weights not in ("uniform", "distance"):
        raise ValueError(f"weights must be 'uniform' or 'distance', got {weights!r}")
    X_train = np.asarray(X_train, dtype=np.float64)
    y_train = np.asarray(y_train)
    X_test = np.asarray(X_test, dtype=np.float64)
    classes = np.unique(y_train)

    preds = []
    for x in X_test:
        dist = np.sqrt(((X_train - x) ** 2).sum(axis=1))
        # Stable sort keeps the earlier training row first when distances tie.
        order = np.argsort(dist, kind="stable")[:k]
        nb_dist = dist[order]
        nb_labels = y_train[order]
        if weights == "uniform":
            nb_w = np.ones(len(order))
        else:
            exact = nb_dist == 0
            if exact.any():
                nb_labels = nb_labels[exact]
                nb_w = np.ones(len(nb_labels))
            else:
                nb_w = 1.0 / nb_dist
        votes = np.array([nb_w[nb_labels == c].sum() for c in classes])
        preds.append(classes[np.argmax(votes)])
    return np.array(preds, dtype=y_train.dtype)


def svm_predict(X, w, b):
    """Labels in {-1, +1} of a linear SVM with weights w and bias b, shape (m,).

    f(x) = x . w + b. A row gets +1 when f(x) >= 0 (so f = 0 counts as +1), otherwise -1.
    """
    X = np.asarray(X, dtype=np.float64)
    w = np.asarray(w, dtype=np.float64)
    f = X @ w + b
    return np.where(f >= 0, 1, -1)


def svm_margin_width(w):
    """Full width of the margin of a linear SVM with weights w: 2 / ||w||."""
    w = np.asarray(w, dtype=np.float64)
    return 2.0 / float(np.linalg.norm(w))


def svm_is_feasible(X, y, w, b):
    """True if every row satisfies y_i * (x_i . w + b) >= 1, allowing a tolerance of 1e-9.

    X: array (n, d); y: array (n,) with labels in {-1, +1}.
    """
    X = np.asarray(X, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    w = np.asarray(w, dtype=np.float64)
    margins = y * (X @ w + b)
    return bool(np.all(margins >= 1 - 1e-9))
