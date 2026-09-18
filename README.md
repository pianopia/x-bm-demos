# x-bm-demos

X bookmark catch-up で作る軽い試作の置き場。

- **Live:** https://x-bm-demos.pages.dev/
- **Host:** Cloudflare Pages project `x-bm-demos` (free tier)
- **Catalog:** [`catalog.json`](./catalog.json) + root [`index.html`](./index.html)

## Add a demo

1. Put static files in `/<slug>/` (needs `index.html` for Pages).
2. Append an entry to `catalog.json`.
3. Regenerate or hand-edit root `index.html` (or run the small catalog→index script if present).
4. Deploy:

```bash
export XDG_CACHE_HOME=/tmp/wrangler-cache
wrangler pages deploy . --project-name x-bm-demos --commit-dirty=true
```

5. Tell the user the **https://x-bm-demos.pages.dev/<slug>/** URL (never only a local path).

## Note

HTML toys only. No secrets. Prefer no build step.
