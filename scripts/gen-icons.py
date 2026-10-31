"""Composes the app icons from the glyphs rendered by scripts/gen-icons.mjs.

The glyph is cropped to its ink and centred optically on a teal square, so the "O"
sits in the middle whatever the font's metrics. Run from the repository root.
"""
import shutil

from PIL import Image, ImageDraw

TEAL = (19, 78, 94, 255)
SS = 8  # supersampling for the rounded corners


def glyph(cut):
    im = Image.open(f"tmp-icons/glyph-{cut}.png").convert("RGBA")
    return im.crop(im.getchannel("A").getbbox())


def icon(size, cut, height, radius):
    """`height` is the glyph's ink height as a share of the icon; `radius` a share of the side."""
    big = size * SS
    base = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(base).rounded_rectangle((0, 0, big - 1, big - 1), radius=radius * big, fill=TEAL)
    g = glyph(cut)
    h = round(height * big)
    g = g.resize((round(g.width * h / g.height), h), Image.LANCZOS)
    base.alpha_composite(g, ((big - g.width) // 2, (big - g.height) // 2))
    return base.resize((size, size), Image.LANCZOS)


icon(512, "display", 0.66, 0.22).save("app/icon.png", optimize=True)
# iOS masks the corners itself and shows transparency as black: full bleed.
icon(180, "display", 0.62, 0).convert("RGB").save("app/apple-icon.png", optimize=True)

small = [icon(48, "text", 0.74, 0.2), icon(32, "text", 0.78, 0.2), icon(16, "text", 0.84, 0.18)]
small[0].save("app/favicon.ico", format="ICO", sizes=[(48, 48), (32, 32), (16, 16)], append_images=small[1:])
shutil.rmtree("tmp-icons")
print("icons written")
