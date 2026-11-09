# 귀가약속 — 음주운전 예방 웹앱

경찰학 캡스톤디자인 과제. 술자리 전·끝·다음 날 아침 세 시점에 개입해 음주운전을 막는 웹앱(PWA).
사용자는 코딩 경험이 없는 대학생이고, 화면 문구는 모두 한국어로 쓴다.

## 반드시 지킬 설계 원칙

1. **판정 금지**: 어떤 수치가 나와도 "운전 가능", "안전", "괜찮음", "운전해도 됩니다" 같은 판정 문구를 쓰지 않는다. 결과는 경고용 추정치로만 표시한다.
2. **보수적 추정**: 숙취 계산은 분해가 느린 사람 기준(위드마크 계수 −0.1, 시간당 분해 0.008%)을 주 결과로 쓰고, 적용한 가정을 화면에 모두 밝힌다.
3. **개인정보 최소 수집**: 이름, 연락처, 위치를 묻거나 저장하지 않는다. 개인 화면의 입력값은 기기의 localStorage에만 둔다. 모임 모드만 예외로 **별명·귀가 방법·차 여부**를 모임 참가자끼리 공유하며, 모임은 끝난 시각 24시간 뒤 자동 삭제한다. 분석 도구·외부 추적 스크립트를 넣지 않는다.
4. **법령은 원문 확인**: 처벌 기준은 도로교통법 [시행 2026. 10. 13.] 제148조의2·제93조 기준이다. 수치·조문을 바꿀 때는 국가법령정보센터 원문으로 확인한 것만 넣고, 확인 못 한 내용(예: 전동킥보드·자전거 범칙금)은 넣지 않는다.
5. **모임 모드의 강제 규칙은 풀지 않는다** (js/group-logic.js 맨 위 주석): 세 항목을 모두 골라야 참가, 차를 가져온 사람은 친구 확인 또는 대리 기사 확인 전까지 미확인, 미확인은 귀가 완료 불가, 미확인 0명이어야 총무 마무리. 서버를 붙이면 이 규칙을 서버에서도 다시 검사한다.

## 구조

```
index.html              화면 마크업 (다섯 화면: #plan #group #pledge #check #law, 모임은 #room-코드 #join-코드)
css/style.css           디자인 토큰(:root)과 전체 스타일, 라이트/다크 테마
js/util.js              공용 함수 (저장소, 날짜, 조사 처리, 토스트, 화면 간 이벤트)
js/model.js             숙취 계산식(위드마크) — 순수 함수
js/group-logic.js       모임 모드 규칙(상태 판정, 참가 검증, 마무리 조건) — 순수 함수
js/config.js            모임 모드 서버 설정(Supabase 주소·공개 키). 비우면 시연판으로 열림
js/plan.js              술자리 계획, 종료 알림, 캘린더(.ics·구글)
js/pledge.js            귀가 서약 카드(캔버스), 공유·저장·복사
js/calc.js              숙취 계산기 화면
js/group-store.js       모임 데이터 저장소 — 서버(Supabase 함수 호출, 5초마다 새로 고침) / 이 기기 시연판
js/group.js             모임 화면(목록·만들기·코드 참가, 참가, 현황판, 시연판일 때만 화면 전환)
js/main.js              화면 전환(해시 라우팅), 서비스 워커 등록, 시작
sw.js                   오프라인 캐시 (파일을 고치면 CACHE 버전을 올린다)
manifest.webmanifest    홈 화면 설치 정보
icons/                  앱 아이콘
tools/build_artifact.py claude.ai 아티팩트용 단일 HTML 만들기 → dist/artifact.html
supabase/schema.sql     서버: 테이블, 직접 접근 차단, 강제 규칙을 검사하는 gwiga_* 함수, 24시간 뒤 자동 삭제
supabase/test.sql       서버 규칙 시험(로컬 Postgres에서 anon 역할로 실행)
supabase/README.md      Supabase 설정 방법
tools/check.mjs         계산식·모임 규칙 점검 스크립트 (node tools/check.mjs)
```

빌드 도구 없이 정적 파일만으로 동작한다. 스크립트는 ES 모듈이 아닌 일반 스크립트이고 `window.Gwiga` 하나에 기능을 묶는다.

## 모임 모드 서버 (Supabase)

- 앱은 테이블을 직접 읽거나 쓰지 않는다. `supabase/schema.sql`의 `gwiga_*` 함수만 부른다(REST: `/rest/v1/rpc/함수이름`).
- 강제 규칙은 `js/group-logic.js`(화면)와 `supabase/schema.sql`(서버) 두 곳에 있다. 규칙을 바꾸면 **두 곳을 함께** 고치고 둘 다 시험한다.
- 총무·참가자 구분은 기기 localStorage(`gwiga-mine-v1`)의 비밀 토큰으로 한다. 서버에는 해시만 저장한다. 로그인·연락처는 받지 않는다.
- 공개 키(publishable/anon)는 config.js에 넣어 GitHub에 올려도 된다. service_role 키나 secret 키는 절대 넣지 않는다.
- 스키마를 바꾸면 Supabase SQL Editor에서 schema.sql을 다시 실행해야 한다(여러 번 실행해도 안전).
- 시연판(`S.mode === 'local'`)에서만 예시 모임·화면 전환·끝날 시간 건너뛰기가 보인다.

## 작업 규칙

- 로컬 확인: `python3 -m http.server 8000` 후 http://localhost:8000 (서비스 워커는 file://에서 동작하지 않음)
- 계산식이나 모임 규칙을 바꾸면 `node tools/check.mjs`를 돌린다.
- 서버 규칙을 바꾸면 로컬 Postgres에 schema.sql을 불러온 뒤 `psql -v ON_ERROR_STOP=1 -f supabase/test.sql`로 시험한다(anon·authenticated 역할을 먼저 만들 것).
- 파일을 바꾸면 `sw.js`의 `CACHE` 값을 올려야 설치된 앱이 새 버전을 받는다.
- 색은 css의 토큰(`--ink`, `--accent` 등)으로만 쓰고, 라이트/다크 둘 다 확인한다.
- 화면 문구를 추가하면 위 1번 원칙의 금지 표현이 없는지 검색한다: `grep -rn "운전 가능\|안전합\|괜찮습\|운전해도" index.html js/`
  (calc.js의 "운전해도 된다는 뜻이 아닙니다", "운전 가능 여부를 알려주지 않습니다"는 부정문이라 허용)
