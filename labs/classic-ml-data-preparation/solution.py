"""Leakage-free preprocessing: reference solution."""

import numpy as np


def impute_median(X_train, X_test):
    X_train = np.asarray(X_train, dtype=np.float64)
    X_test = np.asarray(X_test, dtype=np.float64)
    medians = np.nanmedian(X_train, axis=0)
    X_train_filled = np.where(np.isnan(X_train), medians, X_train)
    X_test_filled = np.where(np.isnan(X_test), medians, X_test)
    return X_train_filled, X_test_filled


def standardize(X_train, X_test):
    X_train = np.asarray(X_train, dtype=np.float64)
    X_test = np.asarray(X_test, dtype=np.float64)
    mean = X_train.mean(axis=0)
    std = X_train.std(axis=0)
    std = np.where(std == 0, 1.0, std)
    return (X_train - mean) / std, (X_test - mean) / std


def one_hot(c_train, c_test):
    categories = sorted(set(c_train))
    index = {c: j for j, c in enumerate(categories)}

    def encode(column):
        out = np.zeros((len(column), len(categories)), dtype=np.float64)
        for i, value in enumerate(column):
            j = index.get(value)
            if j is not None:
                out[i, j] = 1.0
        return out

    return encode(list(c_train)), encode(list(c_test))


def smooth_mean(positives, count, prior, m):
    if count + m == 0:
        return prior
    return (positives + m * prior) / (count + m)


def target_encode(c_train, y_train, c_test, m):
    y = np.asarray(y_train, dtype=np.float64)
    prior = float(y.mean())
    sums = {}
    counts = {}
    for value, target in zip(list(c_train), y.tolist()):
        sums[value] = sums.get(value, 0.0) + target
        counts[value] = counts.get(value, 0) + 1
    out = []
    for value in list(c_test):
        if value in counts:
            out.append(smooth_mean(sums[value], counts[value], prior, m))
        else:
            out.append(prior)
    return np.array(out, dtype=np.float64)


def target_encode_oof(c_train, y_train, folds, m):
    c = list(c_train)
    y = np.asarray(y_train, dtype=np.float64)
    folds = np.asarray(folds)
    out = np.zeros(len(c), dtype=np.float64)
    for k in np.unique(folds):
        inside = np.flatnonzero(folds == k)
        outside = np.flatnonzero(folds != k)
        encoded = target_encode([c[i] for i in outside], y[outside], [c[i] for i in inside], m)
        out[inside] = encoded
    return out


def prepare_features(num_train, num_test, oh_train, oh_test, te_train, te_test, y_train, folds, m):
    num_train, num_test = impute_median(num_train, num_test)
    num_train, num_test = standardize(num_train, num_test)
    oh_tr, oh_te = one_hot(oh_train, oh_test)
    te_tr = target_encode_oof(te_train, y_train, folds, m)
    te_te = target_encode(te_train, y_train, te_test, m)
    X_train = np.hstack([num_train, oh_tr, te_tr[:, None]])
    X_test = np.hstack([num_test, oh_te, te_te[:, None]])
    return X_train, X_test
