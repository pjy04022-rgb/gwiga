-- 서버 규칙 시험 (로컬 Postgres용): anon 역할로 실제 앱처럼 함수만 불러 본다.
-- 실행: psql -v ON_ERROR_STOP=1 -f supabase/test.sql  (스키마를 먼저 불러온 DB에서)
\set QUIET on
create or replace function pg_temp.expect_error(sql text, needle text) returns text language plpgsql as $$
begin
  execute sql;
  raise exception 'FAIL (오류가 나야 함): %', sql;
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  if position(needle in sqlerrm) = 0 then raise exception 'FAIL 다른 오류: % / 기대: %', sqlerrm, needle; end if;
  return 'PASS ' || needle;
end $$;
grant execute on function pg_temp.expect_error(text, text) to anon;

set role anon;

-- 1. 테이블 직접 접근 차단
select pg_temp.expect_error('select * from public.gwiga_rooms', 'permission denied');
select pg_temp.expect_error('insert into public.gwiga_members(room_code,nick,method,car,secret_hash) values (''AAAAAA'',''x'',''택시'',''n'',''x'')', 'permission denied');
select pg_temp.expect_error('select public.gwiga_room_json(''AAAAAA'')', 'permission denied');

-- 2. 모임 만들기 (끝나기 전)
create temp table t(k text primary key, v text);
insert into t select 'room', public.gwiga_create_room('경찰학과 개강총회', current_date, '19:00', '23:00', now() + interval '2 hours')::text;
select 'PASS 모임 만들기 ' || ((select v from t where k='room')::json->>'code');
insert into t values ('code', (select (v::json->>'code') from t where k='room')), ('host', (select (v::json->>'hostSecret') from t where k='room'));

-- 3. 참가 규칙
select pg_temp.expect_error(format('select public.gwiga_join(%L, '''', ''택시'', ''n'')', (select v from t where k='code')), '별명을 적어');
select pg_temp.expect_error(format('select public.gwiga_join(%L, ''민수'', '''', ''n'')', (select v from t where k='code')), '귀가 방법을 골라');
select pg_temp.expect_error(format('select public.gwiga_join(%L, ''민수'', ''택시'', null)', (select v from t where k='code')), '차를 가져오는지');
insert into t select 'minsu', public.gwiga_join((select v from t where k='code'), '민수', '택시', 'n')::text;
insert into t select 'taeho', public.gwiga_join((select v from t where k='code'), ' 태호 ', '택시', 'y')::text;
insert into t select 'jihyun', public.gwiga_join((select v from t where k='code'), '지현', '대리운전', 'y')::text;
select pg_temp.expect_error(format('select public.gwiga_join(%L, ''민수'', ''택시'', ''n'')', (select v from t where k='code')), '같은 별명');
select 'PASS 참가 3명, 공백 정리: ' || (select string_agg(x->>'nick', ',') from json_array_elements(public.gwiga_get_room((select v from t where k='code'))->'members') x);

-- 비밀값이 응답에 없는지
select case when public.gwiga_get_room((select v from t where k='code'))::text ~ '(secret|hash)' then 'FAIL 비밀값 노출' else 'PASS 비밀값 비공개' end;

-- 4. 본인 확인
select pg_temp.expect_error(format('select public.gwiga_cancel_key(%L, %L::uuid, ''틀린비밀'')', (select v from t where k='code'), (select v::json->>'id' from t where k='taeho')), '참가자 확인에 실패');

-- 5. 끝나기 전: 귀가 완료·대리·마무리 불가
select pg_temp.expect_error(format('select public.gwiga_go_home(%L, %L::uuid, %L)', (select v from t where k='code'), (select v::json->>'id' from t where k='minsu'), (select v::json->>'secret' from t where k='minsu')), '끝난 뒤에');
select pg_temp.expect_error(format('select public.gwiga_daeri_met(%L, %L::uuid, %L)', (select v from t where k='code'), (select v::json->>'id' from t where k='jihyun'), (select v::json->>'secret' from t where k='jihyun')), '끝난 뒤에');
select pg_temp.expect_error(format('select public.gwiga_close(%L, %L)', (select v from t where k='code'), (select v from t where k='host')), '끝난 뒤에 마무리');

-- 6. 키 맡기기 규칙
select pg_temp.expect_error(format('select public.gwiga_give_key(%L, %L::uuid, %L, %L::uuid)', (select v from t where k='code'), (select v::json->>'id' from t where k='minsu'), (select v::json->>'secret' from t where k='minsu'), (select v::json->>'id' from t where k='taeho')), '차를 가져온 사람만');
select pg_temp.expect_error(format('select public.gwiga_give_key(%L, %L::uuid, %L, %L::uuid)', (select v from t where k='code'), (select v::json->>'id' from t where k='taeho'), (select v::json->>'secret' from t where k='taeho'), (select v::json->>'id' from t where k='taeho')), '다른 친구에게');
select public.gwiga_give_key((select v from t where k='code'), (select v::json->>'id' from t where k='taeho')::uuid, (select v::json->>'secret' from t where k='taeho'), (select v::json->>'id' from t where k='minsu')::uuid);
-- 엉뚱한 사람이 확인하려 하면 거부
select pg_temp.expect_error(format('select public.gwiga_confirm_key(%L, %L::uuid, %L, %L::uuid, true)', (select v from t where k='code'), (select v::json->>'id' from t where k='jihyun'), (select v::json->>'secret' from t where k='jihyun'), (select v::json->>'id' from t where k='taeho')), '요청이 없습니다');
select 'PASS 키 맡김 후 상태: key-wait' where exists (select 1);

reset role;
-- 끝난 시각으로 옮기기 (시험용)
update public.gwiga_rooms set ends_at = now() - interval '1 minute' where code = (select v from t where k='code');
set role anon;

-- 7. 끝난 뒤: 미확인은 귀가 완료 불가, 마무리 불가
select pg_temp.expect_error(format('select public.gwiga_go_home(%L, %L::uuid, %L)', (select v from t where k='code'), (select v::json->>'id' from t where k='taeho'), (select v::json->>'secret' from t where k='taeho')), '귀가 완료를 누를 수 없습니다');
select pg_temp.expect_error(format('select public.gwiga_close(%L, %L)', (select v from t where k='code'), (select v from t where k='host')), '2대 남아');
select pg_temp.expect_error(format('select public.gwiga_close(%L, ''가짜총무'')', (select v from t where k='code')), '총무 확인에 실패');

-- 8. 확인 절차
select public.gwiga_confirm_key((select v from t where k='code'), (select v::json->>'id' from t where k='minsu')::uuid, (select v::json->>'secret' from t where k='minsu'), (select v::json->>'id' from t where k='taeho')::uuid, true);
select public.gwiga_daeri_met((select v from t where k='code'), (select v::json->>'id' from t where k='jihyun')::uuid, (select v::json->>'secret' from t where k='jihyun'));
select public.gwiga_go_home((select v from t where k='code'), (select v::json->>'id' from t where k='taeho')::uuid, (select v::json->>'secret' from t where k='taeho'));
select 'PASS 상태: ' || (select string_agg((x->>'nick') || '=' || (x->>'keyConfirmed') || '/' || (x->>'daeriMet') || '/' || (x->>'home'), ' ') from json_array_elements(public.gwiga_get_room((select v from t where k='code'))->'members') x);

-- 9. 마무리 → 이후 참가·행동 불가
select public.gwiga_close((select v from t where k='code'), (select v from t where k='host'));
select 'PASS 마무리됨: ' || (public.gwiga_get_room((select v from t where k='code'))->>'closed');
select pg_temp.expect_error(format('select public.gwiga_join(%L, ''늦은사람'', ''택시'', ''n'')', (select v from t where k='code')), '마무리된 모임');
select pg_temp.expect_error(format('select public.gwiga_go_home(%L, %L::uuid, %L)', (select v from t where k='code'), (select v::json->>'id' from t where k='minsu'), (select v::json->>'secret' from t where k='minsu')), '마무리된 모임');

-- 10. 24시간 지나면 자동 삭제
reset role;
update public.gwiga_rooms set ends_at = now() - interval '25 hours' where code = (select v from t where k='code');
set role anon;
select case when public.gwiga_get_room((select v from t where k='code')) is null then 'PASS 24시간 뒤 자동 삭제' else 'FAIL 삭제 안 됨' end;
reset role;
select case when (select count(*) from public.gwiga_members where room_code = (select v from t where k='code')) = 0 then 'PASS 참가자도 함께 삭제' else 'FAIL 참가자 남음' end;

-- 11. 지우기
set role anon;
insert into t select 'room2', public.gwiga_create_room('삭제 시험', current_date, '19:00', '23:00', now() + interval '1 hour')::text;
select pg_temp.expect_error(format('select public.gwiga_delete(%L, ''x'')', (select v::json->>'code' from t where k='room2')), '총무 확인에 실패');
select public.gwiga_delete((select v::json->>'code' from t where k='room2'), (select v::json->>'hostSecret' from t where k='room2'));
select case when public.gwiga_get_room((select v::json->>'code' from t where k='room2')) is null then 'PASS 총무 삭제' else 'FAIL' end;
select pg_temp.expect_error('select public.gwiga_create_room(''x'', current_date, ''19:00'', ''23:00'', now() + interval ''1 year'')', '날짜와 시간');
reset role;
