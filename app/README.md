# 귀가약속 안드로이드·아이폰 앱

웹 화면(저장소 맨 위의 `index.html`, `css/`, `js/`, `icons/`)을 그대로 앱 안에 넣어 만든 안드로이드·아이폰 앱입니다(Capacitor 8).
웹과 앱이 같은 파일을 쓰고, 앱에서만 달라지는 부분은 `js/native.js` 한 곳에 있습니다.

| 기능 | 웹 | 앱 |
|---|---|---|
| 끝날 시간 알림 | 앱이 켜져 있을 때만 | 앱을 꺼 두어도 정확한 시각에 화면 위로 (15분 전·끝날 때·운전 30분 전·모임) |
| 카드·참가 링크 공유 | 브라우저 공유 | 휴대폰 공유 창 |
| 캘린더 파일(.ics) | 내려받기 | 공유 창에서 캘린더 앱 선택 |
| 오프라인 | 서비스 워커 캐시 | 파일이 앱 안에 들어 있음 |

모임 참가 링크는 앱에서도 웹 주소(`https://pjy04022-rgb.github.io/gwiga/#join-코드`)로 만들어, 앱이 없는 친구도 열 수 있습니다.

## 자동 빌드 (GitHub Actions)

main에 화면 파일(`index.html`, `css/`, `js/`, `icons/`)이나 `app/`이 바뀌어 올라오면 `.github/workflows/android.yml`이
APK를 만들어 릴리스에 `gwiga.apk`로 올립니다. 항상 최신 주소:

https://github.com/pjy04022-rgb/gwiga/releases/latest/download/gwiga.apk

- 빌드할 때마다 버전 번호(versionCode)가 올라가 기존 앱 위에 업데이트로 설치됩니다.
- 서명은 저장소에 들어 있는 시험용 키(`android/app/gwiga-debug.keystore`)로 해서, 어디서 빌드해도 서명이 같습니다.
  이 키로 서명하기 전에 다른 방법으로 설치한 앱이 있으면 한 번 지우고 설치해야 합니다.
- 진행 상황은 저장소의 **Actions** 탭에서 볼 수 있고, **Run workflow**로 직접 돌릴 수도 있습니다.

## 내 컴퓨터에서 빌드하기

준비물: Node 22, JDK 21, Android SDK(platform 36, build-tools 36). `ANDROID_HOME`을 SDK 폴더로 지정합니다.

```bash
cd app
npm install
npm run apk
```

결과물: `app/android/app/build/outputs/apk/debug/app-debug.apk`

- 화면(웹 파일)을 고친 뒤에는 `npm run apk`만 다시 돌리면 됩니다.
- 아이콘을 바꾸면 `python3 make-icons.py`를 먼저 돌립니다.

## 알림이 늦거나 안 뜰 때

- 휴대폰 설정 → 애플리케이션 → 귀가약속 → **알림** 허용
- 같은 화면의 **배터리** → **제한 없음**(삼성은 "절전 예외 앱"에 추가)
- 안드로이드 12 이상에서 "알람 및 리마인더" 권한이 꺼져 있으면 앱의 술자리 계획 화면에 **정확한 시간 알림 허용** 버튼이 뜹니다.

## 아이폰 앱

아이폰은 안드로이드처럼 인터넷에서 받은 앱 파일을 바로 설치할 수 없습니다(App Store·TestFlight는 Apple Developer Program 가입 필요).
그래서 아이폰 사용자에게는 두 가지를 안내합니다.

1. **홈 화면에 추가 (모두에게 권장)**: Safari로 웹 주소를 열고 공유 버튼 → **홈 화면에 추가**. 앱처럼 아이콘으로 열리고,
   iOS 16.4 이상이면 열어 둔 동안 알림도 받을 수 있습니다. 웹앱 화면에 iPhone 사용자용 안내가 자동으로 뜹니다.
2. **설치 파일(.ipa) (컴퓨터가 있는 사람)**: GitHub의 Mac 서버(`.github/workflows/ios.yml`)가 서명 없는 설치 파일을 빌드해
   https://github.com/pjy04022-rgb/gwiga/releases/download/ios/gwiga.ipa 에 올립니다.
   Windows나 Mac에서 [Sideloadly](https://sideloadly.io) 같은 도구로 **본인 Apple ID로 서명해** 설치합니다.
   - 무료 Apple ID로 서명한 앱은 **7일** 동안 열리고, 그 뒤에는 다시 설치해야 합니다.
   - 처음 설치하면 아이폰 **설정 → 일반 → VPN 및 기기 관리**에서 개발자를 신뢰하고, **설정 → 개인정보 보호 및 보안 → 개발자 모드**를 켭니다.
   - 이렇게 설치한 앱은 안드로이드 앱처럼 앱을 꺼 두어도 알림이 울립니다.

Actions 탭의 실행 결과(Artifacts)에는 Mac의 Xcode 시뮬레이터용 `gwiga-ios-simulator`도 있습니다.
Mac이 있으면 직접 빌드할 수도 있습니다: `cd app && npm install && npm run ios` 뒤 `ios/App/App.xcodeproj`를 Xcode로 열어 실행.

## 스토어에 올리려면 (아직 안 함)

지금 APK는 시험용 서명입니다. 정확한 알람 권한(USE_EXACT_ALARM)은 Play 스토어 정책상 알람·캘린더 앱에만 허용되므로, 스토어에 올릴 때는 SCHEDULE_EXACT_ALARM만 남기고 앱에서 허용을 안내하는 방식으로 바꿉니다. Google Play에 올리려면 서명 키를 만들어 release 번들(AAB)로 빌드하고,
개발자 계정 등록(25달러, 1회)과 개인정보처리방침 주소가 필요합니다.
App Store는 Apple Developer Program(연 129,000원)에 가입하고 서명 인증서를 만들어야 하며, 심사를 거칩니다.
