"""웹 아이콘(icons/)으로 안드로이드 아이콘을 만든다: python3 make-icons.py"""
import pathlib
from PIL import Image

here = pathlib.Path(__file__).resolve().parent
res = here / "android/app/src/main/res"
plain = Image.open(here.parent / "icons/icon-512.png").convert("RGBA")
mask = Image.open(here.parent / "icons/icon-maskable-512.png").convert("RGBA")

sizes = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for name, k in sizes.items():
    d = res / f"mipmap-{name}"
    launcher = plain.resize((round(48 * k),) * 2, Image.LANCZOS)
    launcher.save(d / "ic_launcher.png")
    launcher.save(d / "ic_launcher_round.png")
    mask.resize((round(108 * k),) * 2, Image.LANCZOS).save(d / "ic_launcher_foreground.png")

# 알림용 작은 아이콘: 흰 글자 '귀'만 남긴 실루엣
glyph = mask.crop((176, 116, 384, 340)).convert("L").point(lambda v: 255 if v > 150 else 0)
canvas = Image.new("L", (256, 256), 0)
canvas.paste(glyph, ((256 - glyph.width) // 2, (256 - glyph.height) // 2))
for name, k in sizes.items():
    d = res / f"drawable-{name}"
    d.mkdir(exist_ok=True)
    a = canvas.resize((round(24 * k),) * 2, Image.LANCZOS)
    icon = Image.new("RGBA", a.size, (255, 255, 255, 0))
    icon.putalpha(a)
    icon.save(d / "ic_stat_gwiga.png")
print("아이콘 준비 완료")
