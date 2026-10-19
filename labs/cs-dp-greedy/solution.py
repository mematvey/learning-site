"""Dynamic programming and greedy: reference solution."""


def edit_distance(a, b):
    """Levenshtein distance between strings `a` and `b`."""
    m, n = len(a), len(b)
    d = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        d[i][0] = i
    for j in range(n + 1):
        d[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
    return d[m][n]


def knapsack(items, capacity):
    """0/1 knapsack. Returns (best_value, chosen) with chosen sorted ascending."""
    n = len(items)
    # best[k][c]: maximum value using the first k items with capacity c
    best = [[0] * (capacity + 1) for _ in range(n + 1)]
    for k in range(1, n + 1):
        value, weight = items[k - 1]
        for c in range(capacity + 1):
            best[k][c] = best[k - 1][c]
            if c >= weight:
                best[k][c] = max(best[k][c], best[k - 1][c - weight] + value)

    # Walk back: item k was taken if its row differs from the row above.
    chosen = []
    c = capacity
    for k in range(n, 0, -1):
        if best[k][c] != best[k - 1][c]:
            chosen.append(k - 1)
            c -= items[k - 1][1]
    chosen.reverse()
    return best[n][capacity], chosen


def min_coins(coins, amount):
    """Minimum number of coins summing to `amount`, or -1 if impossible."""
    inf = float("inf")
    f = [0] + [inf] * amount
    for s in range(1, amount + 1):
        for c in coins:
            if c <= s and f[s - c] + 1 < f[s]:
                f[s] = f[s - c] + 1
    return -1 if f[amount] == inf else f[amount]


def greedy_coins(coins, amount):
    """Greedy change: take the largest coin that fits, repeatedly."""
    taken = []
    remaining = amount
    for coin in sorted(coins, reverse=True):
        while coin <= remaining:
            taken.append(coin)
            remaining -= coin
    return taken if remaining == 0 else None
