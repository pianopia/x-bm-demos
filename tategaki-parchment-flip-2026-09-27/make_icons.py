"""Generate icon-192.png / icon-512.png: an open parchment book with vertical text lines.
Run: python3 make_icons.py   (requires Pillow)"""
import random
from PIL import Image, ImageDraw, ImageFilter

def icon(size):
    S = size * 4  # supersample
    img = Image.new("RGB", (S, S), (28, 20, 14))
    d = ImageDraw.Draw(img)
    # warm room glow
    for r in range(S // 2, 0, -S // 64):
        t = r / (S / 2)
        c = tuple(int(a + (b - a) * (1 - t)) for a, b in zip((28, 20, 14), (74, 52, 32)))
        d.ellipse([S / 2 - r, S / 2 - r * 0.9, S / 2 + r, S / 2 + r * 0.9], fill=c)
    # book block (kept inside the maskable safe zone, ~62% of the canvas)
    x0, x1 = S * 0.19, S * 0.81
    y0, y1 = S * 0.22, S * 0.78
    mid = S / 2
    d.rounded_rectangle([x0 + S * .012, y0 + S * .02, x1 + S * .012, y1 + S * .03], S * .02, fill=(12, 8, 5))
    d.rounded_rectangle([x0 - S * .01, y0 + S * .012, x1 + S * .01, y1 + S * .018], S * .02, fill=(110, 58, 30))
    parch = (239, 224, 189)
    d.polygon([(x0, y0 + S * .02), (mid, y0), (mid, y1), (x0, y1 + S * .005)], fill=parch)
    d.polygon([(mid, y0), (x1, y0 + S * .02), (x1, y1 + S * .005), (mid, y1)], fill=(233, 216, 178))
    # grain
    rnd = random.Random(7)
    px = img.load()
    for _ in range(S * S // 30):
        x, y = rnd.randrange(int(x0), int(x1)), rnd.randrange(int(y0), int(y1))
        r, g, b = px[x, y]
        if (r, g, b) in (parch, (233, 216, 178)):
            k = rnd.randint(-14, 8)
            px[x, y] = (r + k, g + k, b + k)
    # gutter shadow
    for i in range(int(S * .05)):
        a = 1 - i / (S * .05)
        for side in (-1, 1):
            x = int(mid + side * i)
            for y in range(int(y0), int(y1)):
                r, g, b = px[x, y]
                f = 1 - 0.28 * a * a
                px[x, y] = (int(r * f), int(g * f), int(b * f))
    # vertical "text" columns, right to left (縦書き)
    ink = (60, 40, 24)
    lw = max(4, int(S * .012))
    for page_l, page_r in ((x0, mid), (mid, x1)):
        n = 5
        for j in range(n):
            cx = page_r - (page_r - page_l) * (0.2 + j * 0.15)
            top = y0 + S * .08
            length = (y1 - y0 - S * .16) * (1 if (j + (page_l > x0)) % 4 else 0.55)
            d.rounded_rectangle([cx - lw / 2, top, cx + lw / 2, top + length], lw / 2, fill=ink)
    # vermilion seal
    sx, sy, ss = x0 + S * .035, y1 - S * .068, S * .045
    d.rectangle([sx, sy, sx + ss, sy + ss], outline=(168, 50, 31), width=max(3, int(S * .008)))
    img = img.filter(ImageFilter.GaussianBlur(S / 1400))
    return img.resize((size, size), Image.LANCZOS)

for s in (192, 512):
    icon(s).save(f"icon-{s}.png", optimize=True)
    print("wrote", f"icon-{s}.png")
