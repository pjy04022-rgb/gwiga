"""claude.ai 아티팩트용 단일 HTML 만들기: python3 tools/build_artifact.py → dist/artifact.html

index.html의 <!--APP-START--> ~ <!--APP-END--> 마크업과 css, js를 한 파일에 넣는다.
아티팩트에서는 서비스 워커·홈 화면 설치·.ics 저장이 동작하지 않으며, 앱이 스스로 그 기능을 숨긴다.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
html = (ROOT / "index.html").read_text(encoding="utf-8")

fonts = re.search(r"<!--FONTS-START-->(.*?)<!--FONTS-END-->", html, re.S).group(1).strip()
app = re.search(r"<!--APP-START-->(.*?)<!--APP-END-->", html, re.S).group(1).strip()
scripts = re.findall(r'<script src="(js/[^"]+)"></script>', html)
css = (ROOT / "css/style.css").read_text(encoding="utf-8")
js = "\n".join((ROOT / s).read_text(encoding="utf-8") for s in scripts)

out = f"""<title>귀가약속</title>
<meta name="claude:viewport-fit-sides" content="cover">
{fonts}
<style>
{css}
</style>
{app}
<script>
{js}
</script>
"""
dist = ROOT / "dist"
dist.mkdir(exist_ok=True)
(dist / "artifact.html").write_text(out, encoding="utf-8")
print(f"dist/artifact.html ({len(out.encode('utf-8')):,} bytes, scripts: {', '.join(scripts)})")
