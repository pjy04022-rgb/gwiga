/* 모임 모드 서버 설정 (Supabase)
 * Supabase 프로젝트 → Project Settings → API(또는 API Keys)에서 복사해 넣는다.
 *   supabaseUrl: Project URL (https://xxxx.supabase.co)
 *   supabaseKey: publishable 키(sb_publishable_...) 또는 anon public 키
 * 이 키는 공개용이라 GitHub에 올려도 된다. 데이터 보호는 supabase/schema.sql의 함수 규칙이 맡는다.
 * 비워 두면 모임 모드는 이 기기 안에서만 동작하는 시연판으로 열린다.
 */
window.GWIGA_CONFIG = {
  supabaseUrl: '',
  supabaseKey: ''
};
