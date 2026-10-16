"""kNN classification with uniform or distance-weighted voting: reference solution."""

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
