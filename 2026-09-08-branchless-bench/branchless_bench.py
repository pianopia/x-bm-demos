#!/usr/bin/env python3
"""Branchless vs branched microbench — follow-up to X bookmark @ats."""
import time, random, statistics as stats

N = 2_000_000
random.seed(42)
data = [random.random() * 2 - 1 for _ in range(N)]
threshold = 0.0

def branched(xs, t):
    out = 0.0
    for x in xs:
        if x > t:
            out += x
        else:
            out -= x
    return out

def branchless(xs, t):
    out = 0.0
    for x in xs:
        gt = x > t  # bool as 0/1 in arithmetic
        out += gt * x + (1 - gt) * (-x)
    return out

def bench(fn, rounds=5):
    times = []
    val = None
    for _ in range(rounds):
        t0 = time.perf_counter()
        val = fn(data, threshold)
        times.append(time.perf_counter() - t0)
    return val, stats.median(times)

if __name__ == "__main__":
    v1, t1 = bench(branched)
    v2, t2 = bench(branchless)
    assert abs(v1 - v2) < 1e-6
    print(f"N={N:,}")
    print(f"branched:   {t1:.4f}s  (1.00x)")
    print(f"branchless: {t2:.4f}s  ({t2/t1:.2f}x)")
    print(f"result: {v1:.6f}")
