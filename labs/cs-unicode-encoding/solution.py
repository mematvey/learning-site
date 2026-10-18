"""UTF-8 by hand and grapheme counting: reference solution."""

import unicodedata

ZWJ = 0x200D
REGIONAL_FIRST = 0x1F1E6
REGIONAL_LAST = 0x1F1FF


def encode_code_point(cp):
    """Return the UTF-8 bytes of one code point as a list of ints."""
    if not 0 <= cp <= 0x10FFFF:
        raise ValueError(f"code point out of range: {cp:#x}")
    if 0xD800 <= cp <= 0xDFFF:
        raise ValueError(f"surrogate is not a scalar value: {cp:#x}")
    if cp <= 0x7F:
        return [cp]
    if cp <= 0x7FF:
        return [0xC0 | (cp >> 6), 0x80 | (cp & 0x3F)]
    if cp <= 0xFFFF:
        return [
            0xE0 | (cp >> 12),
            0x80 | ((cp >> 6) & 0x3F),
            0x80 | (cp & 0x3F),
        ]
    return [
        0xF0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3F),
        0x80 | ((cp >> 6) & 0x3F),
        0x80 | (cp & 0x3F),
    ]


def utf8_encode(text):
    """Return the UTF-8 bytes of `text` as a list of ints in 0..255."""
    out = []
    for ch in text:
        out.extend(encode_code_point(ord(ch)))
    return out


# (lead byte mask, sequence length, smallest code point allowed for that length)
_LENGTHS = {
    0xC0: (2, 0x80),
    0xE0: (3, 0x800),
    0xF0: (4, 0x10000),
}


def utf8_decode(data):
    """Return the string whose UTF-8 bytes are `data` (a list of ints)."""
    chars = []
    i = 0
    n = len(data)
    while i < n:
        b = data[i]
        if b < 0x80:
            length, cp, smallest = 1, b, 0
        elif 0xC2 <= b <= 0xDF:
            length, cp, smallest = 2, b & 0x1F, 0x80
        elif 0xE0 <= b <= 0xEF:
            length, cp, smallest = 3, b & 0x0F, 0x800
        elif 0xF0 <= b <= 0xF4:
            length, cp, smallest = 4, b & 0x07, 0x10000
        else:
            raise ValueError(f"invalid lead byte {b:#04x} at index {i}")
        if i + length > n:
            raise ValueError(f"truncated sequence at index {i}")
        for k in range(1, length):
            c = data[i + k]
            if (c & 0xC0) != 0x80:
                raise ValueError(f"invalid continuation byte {c:#04x} at index {i + k}")
            cp = (cp << 6) | (c & 0x3F)
        if cp < smallest:
            raise ValueError(f"overlong sequence at index {i}")
        if cp > 0x10FFFF or 0xD800 <= cp <= 0xDFFF:
            raise ValueError(f"not a scalar value {cp:#x} at index {i}")
        chars.append(chr(cp))
        i += length
    return "".join(chars)


def _is_regional(ch):
    return REGIONAL_FIRST <= ord(ch) <= REGIONAL_LAST


def _is_extend(ch):
    cp = ord(ch)
    return (
        unicodedata.combining(ch) != 0
        or cp == ZWJ
        or 0xFE00 <= cp <= 0xFE0F  # variation selectors
        or 0x1F3FB <= cp <= 0x1F3FF  # skin tone modifiers
        or 0xE0020 <= cp <= 0xE007F  # tags
    )


def count_graphemes(text):
    """Return the number of simplified grapheme clusters in `text`."""
    count = 0
    i = 0
    n = len(text)
    while i < n:
        count += 1
        if _is_regional(text[i]) and i + 1 < n and _is_regional(text[i + 1]):
            i += 2
        else:
            i += 1
        # Absorb extenders, and the character joined after a ZWJ.
        while i < n and (_is_extend(text[i]) or ord(text[i - 1]) == ZWJ):
            i += 1
    return count
