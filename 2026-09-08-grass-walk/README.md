# 2026-09-08 bookmark prototypes

## 1. `branchless_bench.py`
Follow-up to @ats branchless / branch-prediction post.

```bash
python3 /workspace/x-bookmarks/demos/2026-09-08/branchless_bench.py
```

Measured here (N=2e6, median of 5): branched `if` ~0.054s, arithmetic "branchless" ~0.096s (**~1.76x slower** in CPython). Lesson: branchless wins in CPU-bound native/hot loops with unpredictable branches; in Python the bool arithmetic often loses. Measure before adopting in Nint services or BELENUS tooling scripts.

## 2. `grass-walk.html`
Ultra-light Three.js "ground presence" sketch inspired by the TUMBLE grassland bookmark. Open in a browser (WASD/arrows).

Not a port of TUMBLE — just a low-cost feel probe for BELENUS / web demos.
