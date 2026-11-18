# 귀가약속 안드로이드·아이폰 앱

웹 화면(저장소 맨 위의 `index.html`, `css/`, `js/`, `icons/`)을 그대로 앱 안에 넣어 만든 안드로이드·아이폰 앱입니다(Capacitor 8).
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

## 아이폰 앱

아이폰 앱은 Mac에서만 빌드할 수 있어, GitHub의 Mac 서버(`.github/workflows/ios.yml`)가 대신 빌드합니다.
저장소 **Actions** 탭 → **아이폰 앱 빌드** → 완료된 실행을 열면 아래쪽 Artifacts에서 내려받습니다.

- `gwiga-ios-unsigned`: 서명 안 된 설치 파일(.ipa). 아이폰은 서명 없는 앱을 설치할 수 없으므로,
  Windows나 Mac에서 [Sideloadly](https://sideloadly.io) 같은 도구로 **본인 Apple ID로 서명해** 설치합니다.
  무료 Apple ID로 서명한 앱은 **7일** 동안 열리고, 그 뒤에는 다시 설치해야 합니다.
  처음 설치하면 아이폰 **설정 → 일반 → VPN 및 기기 관리**에서 개발자를 신뢰하고, **설정 → 개인정보 보호 및 보안 → 개발자 모드**를 켭니다.
- `gwiga-ios-simulator`: Mac의 Xcode 시뮬레이터에 끌어다 놓아 실행하는 파일.

Mac이 있으면 직접 빌드할 수도 있습니다: `cd app && npm install && npm run ios` 뒤 `ios/App/App.xcodeproj`를 Xcode로 열어 실행.

## 스토어에 올리려면 (아직 안 함)

지금 APK는 시험용(debug) 서명입니다. Google Play에 올리려면 서명 키를 만들어 release 번들(AAB)로 빌드하고,
개발자 계정 등록(25달러, 1회)과 개인정보처리방침 주소가 필요합니다.
App Store는 Apple Developer Program(연 129,000원)에 가입하고 서명 인증서를 만들어야 하며, 심사를 거칩니다.
