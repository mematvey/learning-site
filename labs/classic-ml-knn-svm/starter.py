"""kNN classification with uniform or distance-weighted voting, and linear SVM margin: starter code.

Complete `knn_predict` so that it matches the chapter text (section "Код").
Each test row is classified by voting among its k nearest training rows.

Rules:
- Distance is Euclidean.
- weights="uniform": every neighbour has vote 1.
- weights="distance": a neighbour votes 1 / distance. If some neighbour coincides
  with the test row (distance 0), only the coinciding neighbours vote.
- If k is larger than the number of training rows, use all of them.
- Ties in votes are broken by the smaller label.
- Do not modify the inputs.
"""

import numpy as np


def knn_predict(X_train, y_train, X_test, k=3, weights="uniform"):
    """Predict a class for each row of X_test.

    X_train: array (n, d); y_train: array (n,); X_test: array (m, d).
    Returns an array (m,) with one predicted label per test row.
    """
    X_train = np.asarray(X_train, dtype=np.float64)
    y_train = np.asarray(y_train)
    X_test = np.asarray(X_test, dtype=np.float64)

    # TODO: get the sorted list of classes, e.g. classes = np.unique(y_train)
    # TODO: for each test row, compute the distance to every training row
    # TODO: take the k nearest training rows (keep the earlier row first on ties)
    # TODO: pick the neighbour weights: 1 for "uniform"; 1 / distance for "distance",
    #       but if some distance is 0, keep only the zero-distance neighbours with weight 1
    # TODO: sum the weights per class and take the class with the largest sum
    #       (np.argmax over `classes` picks the smaller label on ties)
    raise NotImplementedError("knn_predict is not implemented yet")


def svm_predict(X, w, b):
    """Labels in {-1, +1} of a linear SVM with weights w and bias b, shape (m,).

    f(x) = x . w + b. A row gets +1 when f(x) >= 0 (so f = 0 counts as +1), otherwise -1.
    """
    # TODO: compute f = X @ w + b, then map f >= 0 to +1 and f < 0 to -1
    raise NotImplementedError("svm_predict is not implemented yet")


def svm_margin_width(w):
    """Full width of the margin of a linear SVM with weights w: 2 / ||w||."""
    # TODO: return 2 divided by the Euclidean norm of w
    raise NotImplementedError("svm_margin_width is not implemented yet")


def svm_is_feasible(X, y, w, b):
    """True if every row satisfies y_i * (x_i . w + b) >= 1, allowing a tolerance of 1e-9.

    X: array (n, d); y: array (n,) with labels in {-1, +1}.
    """
    # TODO: compute y * (X @ w + b) and check that all values are >= 1 - 1e-9
    raise NotImplementedError("svm_is_feasible is not implemented yet")
