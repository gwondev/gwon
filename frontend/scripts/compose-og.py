"""Compose the 1200x630 Open Graph card from the Gargantua still + existing G mark."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = Path(r"C:\Users\gwond\.cursor\projects\c-PROJECT-gwon\assets")
OUT = ROOT / "public" / "og-image.png"
W, H = 1200, 630


def load_font(size, names):
    for name in names:
        path = Path(r"C:\Windows\Fonts") / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def knock_black(im: Image.Image, cutoff=28) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r < cutoff and g < cutoff and b < cutoff:
                px[x, y] = (r, g, b, 0)
    return im


def cover(src: Image.Image, box, focus=(0.62, 0.48)) -> Image.Image:
    tw, th = box
    sw, sh = src.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    img = src.resize((nw, nh), Image.Resampling.LANCZOS)
    cx, cy = int(nw * focus[0]), int(nh * focus[1])
    left = max(0, min(nw - tw, cx - tw // 2))
    top = max(0, min(nh - th, cy - th // 2))
    return img.crop((left, top, left + tw, top + th))


hole = Image.open(ASSETS / "og-hole.jpg").convert("RGB")
card = cover(hole, (W, H))

# Soft vignette so left copy sits on black, not on the disk
vignette = Image.new("L", (W, H), 0)
vd = ImageDraw.Draw(vignette)
vd.rectangle((0, 0, 430, H), fill=200)
vignette = vignette.filter(ImageFilter.GaussianBlur(90))
dim = Image.new("RGB", (W, H), (2, 2, 3))
card = Image.composite(dim, card, vignette)

logo = knock_black(Image.open(ROOT / "public" / "apple-touch-icon.png"))
logo = logo.resize((168, 168), Image.Resampling.LANCZOS)
card_rgba = card.convert("RGBA")
card_rgba.alpha_composite(logo, (86, 168))

draw = ImageDraw.Draw(card_rgba)
title = load_font(54, ["segoeuisemibold.ttf", "seguisb.ttf", "segoeui.ttf"])
sub = load_font(18, ["segoeui.ttf", "segoeuil.ttf"])

# GWON
draw.text((92, 360), "GWON", font=title, fill=(242, 235, 224, 255))

# SOFTWARE · AIoT · INFRASTRUCTURE — tracked out
line = "SOFTWARE  ·  AIoT  ·  INFRASTRUCTURE"
# manual tracking
x = 94
for ch in line:
    draw.text((x, 432), ch, font=sub, fill=(196, 184, 166, 230))
    box = draw.textbbox((x, 432), ch, font=sub)
    x = box[2] + 1

final = card_rgba.convert("RGB")
final.save(OUT, "PNG", optimize=True)
print(OUT, final.size, OUT.stat().st_size)
