"""Hidden tests: block counts, tail masks and random inputs.

Messages are not shown to the reader. The runner reports only names and statuses.
"""

# ruff: noqa: F821
import numpy as np


def test_hidden_large_example_counts():
    n, block = 98432, 1024
    programs = num_programs(n, block)
    masked = 0
    for pid in range(programs):
        masked += int((~program_mask(program_offsets(pid, block), n)).sum())
    assert programs == 97, "grid size mismatch for the large example"
    assert masked == 896, "masked lane count mismatch for the large example"


def test_hidden_no_tail_has_no_masked_lanes():
    n, block = 2048, 1024
    assert num_programs(n, block) == 2, "grid size mismatch when n is a multiple of block"
    for pid in range(2):
        assert bool(program_mask(program_offsets(pid, block), n).all()), (
            "mask must be all True when there is no tail"
        )


def test_hidden_single_element_block():
    x = np.array([3.5])
    y = np.array([-1.25])
    assert_close(add_kernel(x, y, 64), x + y, atol=1e-9, message="mismatch for n = 1")


def test_hidden_random_sizes_match_sum():
    rng = np.random.default_rng(0)
    for n in (1, 7, 64, 65, 1000):
        for block in (1, 4, 32, 128):
            x = rng.normal(size=n)
            y = rng.normal(size=n)
            assert_close(
                add_kernel(x, y, block),
                x + y,
                atol=1e-9,
                rtol=1e-9,
                message="mismatch on random input, seed 0",
            )


def test_hidden_large_random_matches_sum():
    rng = np.random.default_rng(1)
    n = 98432
    x = rng.normal(size=n)
    y = rng.normal(size=n)
    assert_close(
        add_kernel(x, y, 1024),
        x + y,
        atol=1e-9,
        rtol=1e-9,
        message="mismatch on large random input, seed 1",
    )
