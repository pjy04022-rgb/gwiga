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

# ---------- 아이폰 ----------
ios = here / "ios/App/App/Assets.xcassets"
if ios.exists():
    # 앱 아이콘: 1024px 한 장, 투명 부분 없이 (모서리는 iOS가 둥글게 깎는다)
    bg = Image.new("RGB", (1024, 1024), (22, 33, 43))
    big = mask.resize((1024, 1024), Image.LANCZOS)
    bg.paste(big, (0, 0), big)
    bg.save(ios / "AppIcon.appiconset/AppIcon-512@2x.png")
    # 시작 화면: 남색 바탕 가운데 아이콘
    splash = Image.new("RGB", (2732, 2732), (22, 33, 43))
    mid = plain.resize((600, 600), Image.LANCZOS)
    splash.paste(mid, ((2732 - 600) // 2, (2732 - 600) // 2), mid)
    for f in (ios / "Splash.imageset").glob("*.png"):
        splash.save(f)
    print("아이폰 아이콘 준비 완료")
