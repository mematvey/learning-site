"""Dataset version from a manifest: starter code.

A dataset is a mapping {path: bytes}. The version is the SHA-256 of the manifest text,
one line "<path>\t<sha256 of the file bytes>\n" per file, sorted by path.
"""


def file_hash(data):
    """SHA-256 hex digest of the bytes of one file."""
    # TODO: import hashlib; raise TypeError if `data` is not bytes; otherwise return the hex digest
    raise NotImplementedError


def manifest_text(files):
    """Manifest: lines "<path>\t<file hash>\n", sorted by path.

    files: a dict {path: bytes} or an iterable of (path, bytes) pairs.
    Raises ValueError if a path contains a tab or a newline.
    """
    # TODO: dict(files), sort by path, check the path, one line per file
    raise NotImplementedError


def manifest_version(files):
    """Version id of a dataset: SHA-256 hex digest of the manifest text."""
    # TODO: hash the manifest text encoded as UTF-8
    raise NotImplementedError
