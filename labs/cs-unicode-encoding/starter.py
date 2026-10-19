"""UTF-8 by hand and grapheme counting: starter code.

Complete the four functions. Do not use `str.encode`, `bytes.decode` or
`bytes(...)` with a string argument in your code: the point is to build the
bytes yourself from code points. The tests compare your results with
`str.encode` at the end.

Rules to follow:
- `encode_code_point(cp)` returns the list of UTF-8 bytes (ints 0..255) for one
  code point. Raise ValueError for surrogates (0xD800..0xDFFF) and for values
  above 0x10FFFF.
- `utf8_encode(text)` returns the list of UTF-8 bytes for the whole string.
- `utf8_decode(data)` takes a list of byte values and returns the string.
  Raise ValueError for truncated sequences, invalid continuation bytes,
  overlong forms and code points that are not valid Unicode scalar values.
- `count_graphemes(text)` counts user-perceived characters with a simplified
  rule: a base code point plus the code points that follow it and extend it
  (combining marks, zero-width joiner U+200D and the code point after it,
  variation selectors, skin tone modifiers, tags); a pair of regional
  indicators forms one grapheme.
"""


def encode_code_point(cp):
    """Return the UTF-8 bytes of one code point as a list of ints.

    cp: an int in 0..0x10FFFF, not a surrogate. Uses 1 to 4 bytes.
    """
    raise NotImplementedError


def utf8_encode(text):
    """Return the UTF-8 bytes of `text` as a list of ints in 0..255."""
    raise NotImplementedError


def utf8_decode(data):
    """Return the string whose UTF-8 bytes are `data` (a list of ints)."""
    raise NotImplementedError


def count_graphemes(text):
    """Return the number of simplified grapheme clusters in `text`."""
    raise NotImplementedError
