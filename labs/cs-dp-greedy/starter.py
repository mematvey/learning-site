"""Dynamic programming and greedy: starter code.

Implement the four functions below. Each one has to match the chapter text.
Use only the standard library.
"""


def edit_distance(a, b):
    """Levenshtein distance between strings `a` and `b`.

    Insertion, deletion and substitution each cost 1. Returns an int.
    Fill a table of size (len(a) + 1) x (len(b) + 1) row by row.
    """
    # TODO: fill the table d[i][j] and return d[len(a)][len(b)]
    raise NotImplementedError


def knapsack(items, capacity):
    """0/1 knapsack.

    items: list of (value, weight) pairs; capacity: int >= 0.
    Returns a tuple (best_value, chosen), where chosen is a list of item
    indices in ascending order whose total weight does not exceed capacity
    and whose total value equals best_value.
    """
    # TODO: fill the table over capacities, then walk it back to recover chosen
    raise NotImplementedError


def min_coins(coins, amount):
    """Minimum number of coins that sum to `amount`, using each coin any number of times.

    Returns -1 if `amount` cannot be formed. Uses dynamic programming over sums.
    """
    # TODO: f[0] = 0 and f[s] = 1 + min(f[s - c]) over coins c <= s
    raise NotImplementedError


def greedy_coins(coins, amount):
    """Greedy change: repeatedly take the largest coin that still fits.

    Returns the list of coins taken, in the order they were taken.
    Returns None if the greedy choice gets stuck before reaching `amount`.
    """
    # TODO: sort coins in descending order and take the largest coin that fits
    raise NotImplementedError
