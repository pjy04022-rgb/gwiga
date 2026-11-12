# 귀가약속 안드로이드 앱

웹 화면(저장소 맨 위의 `index.html`, `css/`, `js/`, `icons/`)을 그대로 앱 안에 넣어 만든 안드로이드 앱입니다(Capacitor 8).
웹과 앱이 같은 파일을 쓰고, 앱에서만 달라지는 부분은 `js/native.js` 한 곳에 있습니다.

| 기능 | 웹 | 앱 |
|---|---|---|
| 끝날 시간 알림 | 앱이 켜져 있을 때만 | 앱을 꺼 두어도 울림 (운전 예정이면 운전 30분 전에도) |
| 카드·참가 링크 공유 | 브라우저 공유 | 휴대폰 공유 창 |
| 캘린더 파일(.ics) | 내려받기 | 공유 창에서 캘린더 앱 선택 |
| 오프라인 | 서비스 워커 캐시 | 파일이 앱 안에 들어 있음 |

모임 참가 링크는 앱에서도 웹 주소(`https://pjy04022-rgb.github.io/gwiga/#join-코드`)로 만들어, 앱이 없는 친구도 열 수 있습니다.

## 다시 빌드하기

준비물: Node 22, JDK 21, Android SDK(platform 36, build-tools 36). `ANDROID_HOME`을 SDK 폴더로 지정합니다.

```bash
cd app
npm install
npm run apk
```

결과물: `app/android/app/build/outputs/apk/debug/app-debug.apk`

- 화면(웹 파일)을 고친 뒤에는 `npm run apk`만 다시 돌리면 됩니다.
- 아이콘을 바꾸면 `python3 make-icons.py`를 먼저 돌립니다.

## 스토어에 올리려면 (아직 안 함)

지금 APK는 시험용(debug) 서명입니다. Google Play에 올리려면 서명 키를 만들어 release 번들(AAB)로 빌드하고,
개발자 계정 등록(25달러, 1회)과 개인정보처리방침 주소가 필요합니다.
