"""Hidden tests: boundaries, invalid input, random strings and grapheme edge cases.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import random


def _random_text(rng, length):
    ranges = [(0x20, 0x7E), (0x400, 0x4FF), (0x800, 0xD7FF), (0x10000, 0x10FFFF)]
    chars = []
    for _ in range(length):
        lo, hi = rng.choice(ranges)
        chars.append(chr(rng.randint(lo, hi)))
    return "".join(chars)


def test_hidden_random_strings_match_str_encode():
    rng = random.Random(0)
    for _ in range(200):
        s = _random_text(rng, rng.randint(1, 12))
        expected = list(s.encode("utf-8"))
        assert utf8_encode(s) == expected, "mismatch on random input, seed 0"
        assert utf8_decode(expected) == s, "decode does not invert encode on random input, seed 0"


def test_hidden_boundary_code_points():
    for cp in (0x0, 0x7F, 0x80, 0x7FF, 0x800, 0xFFFF, 0x10000, 0x10FFFF):
        assert encode_code_point(cp) == list(chr(cp).encode("utf-8")), (
            "boundary code point mismatch"
        )


def test_hidden_surrogates_rejected():
    for cp in (0xD800, 0xDFFF, 0x110000):
        try:
            encode_code_point(cp)
        except ValueError:
            continue
        raise AssertionError("encode_code_point must reject values that are not scalar values")


def test_hidden_truncated_sequence_rejected():
    for bad in ([0xD0], [0xF0, 0x9F, 0x91]):
        try:
            utf8_decode(bad)
        except ValueError:
            continue
        raise AssertionError("truncated sequence must raise ValueError")


def test_hidden_bad_continuation_rejected():
    try:
        utf8_decode([0xD0, 0x41])
    except ValueError:
        return
    raise AssertionError("invalid continuation byte must raise ValueError")


def test_hidden_empty_and_ascii_counts():
    assert utf8_encode("") == [], "empty string has no bytes"
    assert count_graphemes("") == 0, "empty string has no graphemes"
    assert count_graphemes("abc") == 3, "ASCII letters are one grapheme each"


def test_hidden_skin_tone_modifier_joins():
    assert count_graphemes("\U0001f44d\U0001f3fd\U0001f44d\U0001f3fd") == 2, (
        "two thumbs with skin tone must be two graphemes"
    )


def test_hidden_regional_indicator_pairs():
    assert count_graphemes("\U0001f1f7\U0001f1fa") == 1, "one flag is one grapheme"
    assert count_graphemes("\U0001f1f7\U0001f1fa\U0001f1f8\U0001f1f9") == 2, (
        "two flags are two graphemes"
    )
    assert count_graphemes("\U0001f1f7\U0001f1fa\U0001f1f8") == 2, (
        "a lone trailing regional indicator is its own grapheme"
    )


def test_hidden_several_combining_marks_one_grapheme():
    text = "e" + chr(0x301) + chr(0x302)
    assert count_graphemes(text) == 1, "base with two combining marks is one grapheme"


def test_hidden_grapheme_count_not_above_length():
    rng = random.Random(1)
    for _ in range(100):
        s = _random_text(rng, rng.randint(1, 12))
        g = count_graphemes(s)
        assert 1 <= g <= len(s), "grapheme count must be between 1 and len for non-empty text"
