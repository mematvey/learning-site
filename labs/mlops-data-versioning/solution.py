"""Dataset version from a manifest: reference solution.

A dataset is a mapping {path: bytes}. The version is the SHA-256 of the manifest text,
one line "<path>\t<sha256 of the file bytes>\n" per file, sorted by path.
"""

import hashlib


def file_hash(data):
    """SHA-256 hex digest of the bytes of one file."""
    if not isinstance(data, (bytes, bytearray)):
        raise TypeError(f"file content must be bytes, got {type(data).__name__}")
    return hashlib.sha256(bytes(data)).hexdigest()


def manifest_text(files):
    """Manifest: lines "<path>\t<file hash>\n", sorted by path.

    files: a dict {path: bytes} or an iterable of (path, bytes) pairs.
    Raises ValueError if a path contains a tab or a newline.
    """
    items = dict(files)
    lines = []
    for path in sorted(items):
        if "\t" in path or "\n" in path:
            raise ValueError(f"path must not contain a tab or a newline: {path!r}")
        lines.append(f"{path}\t{file_hash(items[path])}\n")
    return "".join(lines)


def manifest_version(files):
    """Version id of a dataset: SHA-256 hex digest of the manifest text."""
    return hashlib.sha256(manifest_text(files).encode("utf-8")).hexdigest()
