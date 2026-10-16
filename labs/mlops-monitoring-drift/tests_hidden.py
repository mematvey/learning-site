"""Hidden tests: scale, ties, out-of-range values and agreement with slow references.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import itertools

import numpy as np

EPS = 1e-4


def _psi_reference(reference, current, bins):
    """PSI via np.histogram with explicit edges; outer edges are widened to cover everything."""
    ref = np.asarray(reference, dtype=float)
    cur = np.asarray(current, dtype=float)
    edges = np.quantile(ref, np.linspace(0.0, 1.0, bins + 1))
    edges[0] = min(ref.min(), cur.min()) - 1.0
    edges[-1] = max(ref.max(), cur.max()) + 1.0
    p = np.histogram(ref, bins=edges)[0] / ref.size
    q = np.histogram(cur, bins=edges)[0] / cur.size
    p = np.maximum(p, EPS)
    q = np.maximum(q, EPS)
    return float(np.sum((p - q) * np.log(p / q)))


def _ks_reference(a, b):
    """D by evaluating both ECDFs at every sample point, one point at a time."""
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    d = 0.0
    for x in np.union1d(a, b):
        fa = np.mean(a <= x)
        fb = np.mean(b <= x)
        d = max(d, abs(fa - fb))
    return d


def test_hidden_psi_matches_histogram_reference():
    rng = np.random.default_rng(0)
    ref = rng.normal(size=1000)
    cur = rng.normal(loc=0.7, size=800)
    assert_close(
        psi(ref, cur, bins=10),
        _psi_reference(ref, cur, 10),
        atol=1e-6,
        rtol=1e-5,
        message="mismatch on random input, seed 0",
    )


def test_hidden_psi_matches_reference_with_out_of_range_values():
    rng = np.random.default_rng(1)
    ref = rng.normal(size=500)
    cur = rng.uniform(-6.0, 6.0, size=600)  # many values fall outside the reference range
    assert_close(
        psi(ref, cur, bins=5),
        _psi_reference(ref, cur, 5),
        atol=1e-6,
        rtol=1e-5,
        message="mismatch on random input, seed 1",
    )


def test_hidden_psi_grows_with_shift():
    rng = np.random.default_rng(2)
    ref = rng.normal(size=2000)
    z = rng.normal(size=2000)
    values = [psi(ref, z + s) for s in (0.0, 0.25, 0.5, 1.0, 2.0)]
    assert all(np.isfinite(values)), f"non-finite PSI values: {values}"
    assert all(v1 < v2 for v1, v2 in itertools.pairwise(values)), (
        "PSI must increase as the production sample moves away from the reference"
    )


def test_hidden_psi_with_tied_reference_stays_finite():
    # Repeated values make several quantile edges coincide and leave empty bins.
    ref = np.array([0.0] * 50 + [1.0] * 50)
    rng = np.random.default_rng(3)
    cur = rng.integers(0, 2, size=200).astype(float)
    value = psi(ref, cur, bins=10)
    assert np.isfinite(value), f"PSI must be finite with tied reference, got {value}"
    assert_close(
        psi(ref, ref, bins=10),
        0.0,
        atol=1e-12,
        message="equal samples must give PSI 0 even with ties",
    )


def test_hidden_psi_detects_large_shift():
    rng = np.random.default_rng(4)
    ref = rng.normal(size=400)
    assert_close(
        psi(ref, ref.copy(), bins=10), 0.0, atol=1e-12, message="same sample must give PSI 0"
    )
    assert psi(ref, ref + 1.5, bins=10) > 0.25, "a 1.5 sigma shift must be a clear alarm"


def test_hidden_ks_matches_ecdf_reference():
    rng = np.random.default_rng(5)
    a = rng.normal(size=200)
    b = rng.normal(loc=0.4, size=300)
    assert_close(
        ks_statistic(a, b),
        _ks_reference(a, b),
        atol=1e-12,
        message="mismatch on random input, seed 5",
    )


def test_hidden_ks_is_symmetric_and_order_independent():
    rng = np.random.default_rng(6)
    a = rng.normal(size=150)
    b = rng.exponential(size=90)
    d = ks_statistic(a, b)
    assert_close(ks_statistic(b, a), d, atol=1e-12, message="KS must be symmetric")
    assert_close(
        ks_statistic(rng.permutation(a), rng.permutation(b)),
        d,
        atol=1e-12,
        message="KS must not depend on the order of the sample",
    )


def test_hidden_ks_bounds():
    rng = np.random.default_rng(7)
    a = rng.normal(size=50)
    assert_close(
        ks_statistic(a, a + 100.0), 1.0, atol=1e-12, message="disjoint samples must give D = 1"
    )
    d = ks_statistic(a, rng.normal(size=70))
    assert 0.0 <= d <= 1.0, f"D must lie in [0, 1], got {d}"
