// 웹 파일(저장소 맨 위)을 앱에 넣을 폴더 app/www 로 복사한다: node build-www.mjs
// 웹과 앱이 같은 파일을 쓰므로, 화면을 고치면 이 스크립트를 다시 돌리고 앱을 다시 빌드하면 된다.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const www = join(here, 'www');

rmSync(www, { recursive: true, force: true });
mkdirSync(www);
for (const name of ['index.html', 'css', 'js', 'icons']) cpSync(join(root, name), join(www, name), { recursive: true });

// 앱에는 홈 화면 설치 정보(manifest)와 서비스 워커가 필요 없다.
const htmlPath = join(www, 'index.html');
writeFileSync(htmlPath, readFileSync(htmlPath, 'utf8')
  .replace(/^<link rel="manifest"[^\n]*\n/m, '')
  .replace('<script src="js/util.js"></script>', '<script src="js/build.js"></script>\n<script src="js/util.js"></script>'));

// 빌드 번호: GitHub에서 빌드하면 릴리스 번호와 같아, 앱이 새 버전이 나왔는지 알 수 있다(js/update.js).
const wf = process.env.GITHUB_WORKFLOW || '';
const build = { run: Number(process.env.GITHUB_RUN_NUMBER || 0), platform: /아이폰|ios/i.test(wf) ? 'ios' : 'android', builtAt: new Date().toISOString() };
writeFileSync(join(www, 'js', 'build.js'), 'window.GWIGA_BUILD = ' + JSON.stringify(build) + ';\n');

// 상태 표시줄·내비게이션 바 여백: 오래된 안드로이드 웹뷰는 env(safe-area-inset-*)가 0이라
// Capacitor가 넣어 주는 --safe-area-inset-* 값을 먼저 쓴다.
const cssPath = join(www, 'css', 'style.css');
writeFileSync(cssPath, readFileSync(cssPath, 'utf8')
  .replace(/env\(safe-area-inset-(top|right|bottom|left),0px\)/g, 'var(--safe-area-inset-$1,env(safe-area-inset-$1,0px))'));

console.log('app/www 준비 완료');
