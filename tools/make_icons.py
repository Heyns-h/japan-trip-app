"""Draws the home-screen icons: a vermilion sun over a white snow-capped peak on ink. Needs Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

out = Path(__file__).resolve().parent.parent / "docs" / "icons"
out.mkdir(parents=True, exist_ok=True)
for size in (192, 512):
    s = size * 4  # draw large, then downsample for smooth edges
    im = Image.new("RGB", (s, s), "#17202b")
    d = ImageDraw.Draw(im)
    r = s * 0.2
    d.ellipse((s / 2 - r, s * 0.2, s / 2 + r, s * 0.2 + 2 * r), fill="#c43d27")
    d.polygon([(s * 0.12, s * 0.82), (s * 0.5, s * 0.42), (s * 0.88, s * 0.82)], fill="#e6ebf1")
    d.polygon([(s * 0.12, s * 0.82), (s * 0.5, s * 0.42), (s * 0.88, s * 0.82), (s * 0.66, s * 0.82), (s * 0.5, s * 0.6), (s * 0.34, s * 0.82)], fill="#e6ebf1")
    d.polygon([(s * 0.34, s * 0.82), (s * 0.5, s * 0.6), (s * 0.66, s * 0.82)], fill="#5a6575")
    im.resize((size, size), Image.LANCZOS).save(out / f"icon-{size}.png")
print("icons written to", out)
