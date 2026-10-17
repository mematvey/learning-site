"""Visible tests. The runner executes starter.py (or solution.py) in the same namespace first."""

# ruff: noqa: F821

FILES = {"data/train.csv": b"a,b\n1,2\n", "data/labels.csv": b"y\n0\n1\n"}


def test_file_hash_is_sha256_of_bytes():
    expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    assert file_hash(b"abc") == expected, f"expected SHA-256 of b'abc', got {file_hash(b'abc')!r}"


def test_manifest_lines_are_sorted_by_path():
    lines = manifest_text(FILES).splitlines()
    paths = [line.split("\t")[0] for line in lines]
    assert paths == ["data/labels.csv", "data/train.csv"], f"paths not sorted: {paths!r}"


def test_version_does_not_depend_on_file_order():
    forward = list(FILES.items())
    backward = forward[::-1]
    assert manifest_version(forward) == manifest_version(backward), (
        "the same files in another order must give the same version"
    )


def test_one_changed_byte_changes_the_version():
    changed = dict(FILES)
    changed["data/train.csv"] = b"a,b\n1,3\n"
    assert manifest_version(FILES) != manifest_version(changed), (
        "changing one byte must change the version"
    )


def test_same_content_gives_same_version():
    assert manifest_version(dict(FILES)) == manifest_version(dict(FILES)), (
        "the version must be deterministic"
    )
