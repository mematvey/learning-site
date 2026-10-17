"""Hidden tests: renames, empty datasets, bad input and an exact known value.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import hashlib


def test_rename_changes_the_version():
    a = {"a.csv": b"x"}
    b = {"b.csv": b"x"}
    assert manifest_version(a) != manifest_version(b), "the path is part of the version"


def test_swapping_contents_between_paths_changes_the_version():
    a = {"a.csv": b"1", "b.csv": b"2"}
    b = {"a.csv": b"2", "b.csv": b"1"}
    assert manifest_version(a) != manifest_version(b), "path and content must stay paired"


def test_empty_dataset_is_hash_of_empty_text():
    assert manifest_version({}) == hashlib.sha256(b"").hexdigest(), "empty manifest is empty text"


def test_exact_value_for_one_file():
    data = b"hello"
    line = "f.txt\t" + hashlib.sha256(data).hexdigest() + "\n"
    assert manifest_text({"f.txt": data}) == line, f"unexpected manifest {manifest_text({'f.txt': data})!r}"
    assert manifest_version({"f.txt": data}) == hashlib.sha256(line.encode()).hexdigest(), (
        "version must be SHA-256 of the manifest text"
    )


def test_empty_file_is_allowed_and_differs_from_missing_file():
    with_empty = {"a": b"", "b": b"1"}
    without = {"b": b"1"}
    assert manifest_version(with_empty) != manifest_version(without), "an empty file still counts"


def test_non_bytes_content_raises_type_error():
    try:
        manifest_version({"a.txt": "text"})
    except TypeError:
        return
    raise AssertionError("str content must raise TypeError")


def test_separator_in_path_raises_value_error():
    for bad in ("a\tb", "a\nb"):
        try:
            manifest_version({bad: b"x"})
        except ValueError:
            continue
        raise AssertionError(f"path {bad!r} must raise ValueError")


def test_accepts_bytearray_and_matches_bytes():
    assert manifest_version({"a": bytearray(b"xy")}) == manifest_version({"a": b"xy"}), (
        "bytearray content equals bytes content"
    )
