from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "assets" / "images"
ROOT.mkdir(parents=True, exist_ok=True)
SIZE = 1024
SCALE = 4
INK = "#102D2B"
LIME = "#D8F56B"
MINT = "#80C6A4"
PAPER = "#F6F5EF"


def cubic_points(p0, p1, p2, p3, steps=90):
    points = []
    for index in range(steps + 1):
        t = index / steps
        u = 1 - t
        x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
        y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
        points.append((round(x * SCALE), round(y * SCALE)))
    return points


def bezier_chain(segments):
    points = []
    for index, segment in enumerate(segments):
        curve = cubic_points(*segment)
        points.extend(curve if index == 0 else curve[1:])
    return points


def circle(draw, center, radius, fill):
    x, y = center
    r = radius * SCALE
    draw.ellipse((x * SCALE - r, y * SCALE - r, x * SCALE + r, y * SCALE + r), fill=fill)


def make_mark(monochrome=False):
    canvas = Image.new("RGBA", (SIZE * SCALE, SIZE * SCALE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    color_lime = PAPER if monochrome else LIME
    color_mint = PAPER if monochrome else MINT

    route_one = [
        ((232, 674), (340, 571), (330, 416), (471, 339)),
        ((471, 339), (612, 262), (738, 403), (787, 611)),
    ]
    route_two = [
        ((302, 703), (405, 621), (413, 500), (521, 469)),
        ((521, 469), (630, 439), (693, 550), (725, 686)),
    ]
    route_three = [
        ((327, 429), (410, 336), (491, 305), (583, 350)),
        ((583, 350), (640, 378), (687, 435), (717, 503)),
    ]

    draw.line(bezier_chain(route_one), fill=color_lime, width=80 * SCALE, joint="curve")
    draw.line(bezier_chain(route_two), fill=color_mint, width=54 * SCALE, joint="curve")
    draw.line(bezier_chain(route_three), fill=color_lime, width=34 * SCALE, joint="curve")

    for center, radius, color in [
        ((232, 674), 42, color_lime),
        ((787, 611), 37, color_mint),
        ((327, 429), 31, color_lime),
    ]:
        circle(draw, center, radius, color)

    return canvas.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def main():
    mark = make_mark()
    mark.save(ROOT / "behin-mark.png")
    mark.save(ROOT / "splash-icon.png")

    background = Image.new("RGBA", (SIZE, SIZE), INK)
    background.alpha_composite(mark)
    background.convert("RGB").save(ROOT / "icon.png", quality=95)

    background.resize((512, 512), Image.Resampling.LANCZOS).save(
        ROOT / "android-icon-background.png"
    )
    mark.save(ROOT / "android-icon-foreground.png")
    make_mark(monochrome=True).save(ROOT / "android-icon-monochrome.png")
    background.resize((64, 64), Image.Resampling.LANCZOS).save(ROOT / "favicon.png")


if __name__ == "__main__":
    main()
