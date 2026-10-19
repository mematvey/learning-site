"""Visible tests. `encode_code_point`, `utf8_encode`, `utf8_decode` and
`count_graphemes` come from the runner (starter.py or solution.py).
"""

# ruff: noqa: F821


def test_russian_word_is_twelve_bytes():
    # Each Cyrillic letter is in U+0080..U+07FF and takes two bytes.
    data = utf8_encode("привет")
    expected = [0xD0, 0xBF, 0xD1, 0x80, 0xD0, 0xB8, 0xD0, 0xB2, 0xD0, 0xB5, 0xD1, 0x82]
    assert len(data) == 12, f"expected 12 bytes, got {len(data)}"
    assert data == expected, f"expected {[hex(b) for b in expected]}, got {[hex(b) for b in data]}"


def test_thumbs_up_is_four_bytes():
    data = utf8_encode("\U0001f44d")
    expected = [0xF0, 0x9F, 0x91, 0x8D]
    assert data == expected, f"expected {[hex(b) for b in expected]}, got {[hex(b) for b in data]}"


def test_single_code_point_bytes():
    assert encode_code_point(0x41) == [0x41], "latin A must be one byte"
    assert encode_code_point(0x41F) == [0xD0, 0x9F], "U+041F must be D0 9F"


def test_decode_cyrillic_pair():
    text = utf8_decode([0xD0, 0x9F])
    assert text == "П", f"expected 'П', got {text!r}"


def test_family_emoji_is_five_code_points_one_grapheme():
    # Woman, ZWJ, woman, ZWJ, girl: five code points, eighteen bytes, one visible sign.
    zwj = chr(0x200D)
    family = "\U0001f469" + zwj + "\U0001f469" + zwj + "\U0001f467"
    assert len(family) == 5, f"expected len 5, got {len(family)}"
    assert len(utf8_encode(family)) == 18, "expected 18 bytes in UTF-8"
    assert count_graphemes(family) == 1, f"expected 1 grapheme, got {count_graphemes(family)}"


def test_combining_mark_is_one_grapheme():
    # Letter e plus combining acute accent: two code points, one visible letter.
    text = "e" + chr(0x301)
    assert len(text) == 2, f"expected len 2, got {len(text)}"
    assert count_graphemes(text) == 1, f"expected 1 grapheme, got {count_graphemes(text)}"
    assert utf8_encode(text) == [0x65, 0xCC, 0x81], "e followed by U+0301 is 65 CC 81"
