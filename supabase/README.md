# 모임 모드 서버 설정 (Supabase, 무료)

모임 모드에서 친구들이 각자 휴대폰으로 참가하려면 서버가 필요합니다. 아래 과정은 한 번만 하면 되고 10분 정도 걸립니다.

## 1. 프로젝트 만들기

1. https://supabase.com 에서 **Start your project** → GitHub 계정으로 로그인
2. **New project**
   - Name: `gwiga`
   - Database Password: 아무 비밀번호(앱에는 쓰지 않으니 따로 적어만 두세요)
   - Region: **Northeast Asia (Seoul)**
   - Plan: Free
3. 만들어지는 데 1~2분 걸립니다.

## 2. 서버 규칙 넣기

1. 왼쪽 메뉴 **SQL Editor** → **New query**
2. 이 저장소의 `supabase/schema.sql` 내용 전체를 복사해 붙여넣고 **Run**
3. 아래에 `Success. No rows returned`가 나오면 끝입니다.

## 3. 주소와 공개 키 복사

1. 왼쪽 아래 **Project Settings**(톱니바퀴) → **API Keys** (또는 **API**)
2. 두 가지를 복사합니다.
   - **Project URL**: `https://xxxxxxxx.supabase.co` (Project Settings → Data API 또는 API 화면 위쪽)
   - **Publishable key** (`sb_publishable_...`로 시작). 없으면 **anon public** 키(`eyJ...`로 시작)
3. **secret 키나 service_role 키는 복사하지 마세요.** 이 키는 앱에 넣으면 안 됩니다.

## 4. 앱에 넣기

`js/config.js`에 붙여넣습니다.

```js
window.GWIGA_CONFIG = {
  supabaseUrl: 'https://xxxxxxxx.supabase.co',
  supabaseKey: 'sb_publishable_...'
};
```

GitHub에 올리면 1~2분 뒤 배포 주소에 반영됩니다. 모임 화면 아래쪽에 "시연판" 문구가 사라지고 "모임에는 별명, 귀가 방법, 차 여부만 저장됩니다"가 보이면 서버에 연결된 것입니다.

## 참고

- 무료 요금제 프로젝트는 일주일 동안 아무도 쓰지 않으면 일시 정지됩니다. Supabase 대시보드에서 **Restore**를 누르면 다시 켜집니다. 발표 전날 한 번 열어 두세요.
- 모임은 끝난 시각 24시간 뒤, 누군가 앱을 쓸 때 자동으로 지워집니다.
- 저장되는 정보는 모임 이름·시간, 참가자 별명·귀가 방법·차 여부·키 확인 상태뿐입니다.
