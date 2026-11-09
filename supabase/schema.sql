-- =====================================================================
-- 귀가약속 모임 모드 서버 (Supabase)
-- 사용법: Supabase 프로젝트 → SQL Editor → New query → 이 파일 전체를 붙여넣고 Run
-- 여러 번 실행해도 됩니다(테이블은 그대로 두고 함수만 새로 바꿉니다).
--
-- 원칙
--  * 저장 항목은 별명·귀가 방법·차 여부·키 확인 상태뿐. 이름·연락처·위치는 받지 않는다.
--  * 앱(anon)은 테이블을 직접 읽거나 쓸 수 없고, 아래 gwiga_* 함수만 부를 수 있다.
--    함수가 강제 규칙을 서버에서 다시 검사하므로 화면을 우회해도 규칙을 깰 수 없다.
--  * 총무·참가자 구분은 기기에 저장한 비밀 토큰으로 한다(서버에는 해시만 저장).
--  * 모임은 끝난 시각 24시간 뒤 자동 삭제된다.
-- =====================================================================

create table if not exists public.gwiga_rooms (
  code        text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  title       text not null check (char_length(title) between 1 and 30),
  date        date not null,
  start_time  text not null check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  end_time    text not null check (end_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  ends_at     timestamptz not null,
  host_hash   text not null,
  closed      boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.gwiga_members (
  id            uuid primary key default gen_random_uuid(),
  room_code     text not null references public.gwiga_rooms(code) on delete cascade,
  nick          text not null check (char_length(nick) between 1 and 12),
  method        text not null check (method in ('택시','대리운전','심야버스·지하철','걸어서','가족 차','근처 숙소')),
  car           text not null check (car in ('y','n')),
  key_to        uuid references public.gwiga_members(id) on delete set null,
  key_confirmed boolean not null default false,
  daeri_met     boolean not null default false,
  home          boolean not null default false,
  secret_hash   text not null,
  joined_at     timestamptz not null default now(),
  unique (room_code, nick)
);
create index if not exists gwiga_members_room_idx on public.gwiga_members(room_code);

-- 직접 접근 차단: 정책 없이 RLS를 켜면 anon·authenticated는 아무것도 못 읽고 못 쓴다.
alter table public.gwiga_rooms   enable row level security;
alter table public.gwiga_members enable row level security;
revoke all on public.gwiga_rooms, public.gwiga_members from anon, authenticated;

-- ---------------------------------------------------------------------
-- 내부 도우미 (앱에서 부를 수 없음)
-- ---------------------------------------------------------------------
create or replace function public.gwiga_hash(t text) returns text
language sql immutable as $$ select md5('gwiga:' || coalesce(t, '')) $$;

create or replace function public.gwiga_status(m public.gwiga_members) returns text
language sql immutable as $$
  select case
    when m.home then 'home'
    when m.car <> 'y' then 'ok'
    when m.key_confirmed then 'key'
    when m.method = '대리운전' and m.daeri_met then 'daeri'
    when m.key_to is not null then 'key-wait'
    else 'pending' end
$$;

create or replace function public.gwiga_purge() returns void
language sql security definer set search_path = public as $$
  delete from gwiga_rooms where ends_at < now() - interval '24 hours'
$$;

create or replace function public.gwiga_room_json(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'code', r.code, 'title', r.title, 'date', r.date, 'start', r.start_time, 'end', r.end_time,
    'endsAt', r.ends_at, 'closed', r.closed, 'serverNow', now(),
    'members', coalesce((
      select json_agg(json_build_object(
        'id', m.id, 'nick', m.nick, 'method', m.method, 'car', m.car,
        'keyTo', m.key_to, 'keyConfirmed', m.key_confirmed, 'daeriMet', m.daeri_met, 'home', m.home,
        'joinedAt', floor(extract(epoch from m.joined_at) * 1000)::bigint
      ) order by m.joined_at)
      from gwiga_members m where m.room_code = r.code), '[]'::json))
  from gwiga_rooms r where r.code = p_code
$$;

-- 참가자 본인 확인. 성공하면 그 참가자 행을 돌려준다.
create or replace function public.gwiga_auth(p_code text, p_member uuid, p_secret text)
returns public.gwiga_members
language plpgsql security definer set search_path = public as $$
declare m gwiga_members; r gwiga_rooms;
begin
  select * into r from gwiga_rooms where code = p_code;
  if not found then raise exception '모임을 찾을 수 없습니다.'; end if;
  select * into m from gwiga_members where id = p_member and room_code = p_code and secret_hash = gwiga_hash(p_secret);
  if not found then raise exception '참가자 확인에 실패했습니다. 이 모임에 참가한 기기에서 다시 열어 주세요.'; end if;
  if r.closed then raise exception '이미 마무리된 모임입니다.'; end if;
  return m;
end $$;

create or replace function public.gwiga_ended(p_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select now() >= ends_at from gwiga_rooms where code = p_code), false)
$$;

-- ---------------------------------------------------------------------
-- 앱에서 부르는 함수
-- ---------------------------------------------------------------------

-- 모임 만들기 → {code, hostSecret}
create or replace function public.gwiga_create_room(p_title text, p_date date, p_start text, p_end text, p_ends_at timestamptz)
returns json language plpgsql security definer set search_path = public as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text; v_secret text := gen_random_uuid()::text; v_title text := btrim(regexp_replace(coalesce(p_title,''), '\s+', ' ', 'g'));
  i int;
begin
  perform gwiga_purge();
  if v_title = '' then raise exception '모임 이름을 적어 주세요.'; end if;
  if char_length(v_title) > 30 then v_title := left(v_title, 30); end if;
  if p_ends_at is null or p_ends_at < now() - interval '12 hours' or p_ends_at > now() + interval '90 days' then
    raise exception '모임 날짜와 시간을 다시 확인해 주세요.';
  end if;
  if (select count(*) from gwiga_rooms where created_at > now() - interval '1 minute') > 60 then
    raise exception '지금은 모임을 만들 수 없습니다. 잠시 뒤 다시 시도해 주세요.';
  end if;
  loop
    v_code := '';
    for i in 1..6 loop v_code := v_code || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    exit when not exists (select 1 from gwiga_rooms where code = v_code);
  end loop;
  insert into gwiga_rooms(code, title, date, start_time, end_time, ends_at, host_hash)
  values (v_code, v_title, p_date, p_start, p_end, p_ends_at, gwiga_hash(v_secret));
  return json_build_object('code', v_code, 'hostSecret', v_secret);
end $$;

-- 모임 보기 (비밀값은 돌려주지 않음) → 모임 JSON 또는 null
create or replace function public.gwiga_get_room(p_code text)
returns json language plpgsql security definer set search_path = public as $$
begin
  perform gwiga_purge();
  return gwiga_room_json(upper(p_code));
end $$;

-- 참가: 별명·귀가 방법·차 여부를 모두 골라야 함 → {id, secret}
create or replace function public.gwiga_join(p_code text, p_nick text, p_method text, p_car text)
returns json language plpgsql security definer set search_path = public as $$
declare r gwiga_rooms; v_nick text := btrim(regexp_replace(coalesce(p_nick,''), '\s+', ' ', 'g')); v_secret text := gen_random_uuid()::text; v_id uuid;
begin
  select * into r from gwiga_rooms where code = upper(p_code);
  if not found then raise exception '모임을 찾을 수 없습니다.'; end if;
  if r.closed then raise exception '이미 마무리된 모임입니다.'; end if;
  if v_nick = '' then raise exception '별명을 적어 주세요.'; end if;
  if char_length(v_nick) > 12 then raise exception '별명은 12자 이하로 적어 주세요.'; end if;
  if p_method is null or p_method not in ('택시','대리운전','심야버스·지하철','걸어서','가족 차','근처 숙소') then raise exception '귀가 방법을 골라 주세요.'; end if;
  if p_car is null or p_car not in ('y','n') then raise exception '차를 가져오는지 골라 주세요.'; end if;
  if exists (select 1 from gwiga_members where room_code = r.code and nick = v_nick) then raise exception '같은 별명이 이미 있습니다. 다른 별명을 적어 주세요.'; end if;
  if (select count(*) from gwiga_members where room_code = r.code) >= 60 then raise exception '참가 인원이 가득 찼습니다.'; end if;
  insert into gwiga_members(room_code, nick, method, car, secret_hash)
  values (r.code, v_nick, p_method, p_car, gwiga_hash(v_secret)) returning id into v_id;
  return json_build_object('id', v_id, 'secret', v_secret);
end $$;

-- 차 키를 친구에게 맡김 (친구가 확인할 때까지 '키 확인 대기')
create or replace function public.gwiga_give_key(p_code text, p_member uuid, p_secret text, p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m gwiga_members := gwiga_auth(p_code, p_member, p_secret);
begin
  if m.car <> 'y' then raise exception '차를 가져온 사람만 키를 맡길 수 있습니다.'; end if;
  if p_target = m.id then raise exception '키는 다른 친구에게 맡겨 주세요.'; end if;
  if not exists (select 1 from gwiga_members where id = p_target and room_code = m.room_code) then raise exception '그 친구는 이 모임에 없습니다.'; end if;
  update gwiga_members set key_to = p_target, key_confirmed = false where id = m.id;
end $$;

-- 맡긴 키 요청 취소
create or replace function public.gwiga_cancel_key(p_code text, p_member uuid, p_secret text)
returns void language plpgsql security definer set search_path = public as $$
declare m gwiga_members := gwiga_auth(p_code, p_member, p_secret);
begin
  update gwiga_members set key_to = null, key_confirmed = false where id = m.id and not home;
end $$;

-- 키를 받은 친구가 확인(p_ok = true) 또는 거절(false)
create or replace function public.gwiga_confirm_key(p_code text, p_member uuid, p_secret text, p_owner uuid, p_ok boolean)
returns void language plpgsql security definer set search_path = public as $$
declare m gwiga_members := gwiga_auth(p_code, p_member, p_secret);
begin
  if not exists (select 1 from gwiga_members where id = p_owner and room_code = m.room_code and key_to = m.id) then
    raise exception '나에게 키를 맡긴 요청이 없습니다.';
  end if;
  if p_ok then update gwiga_members set key_confirmed = true where id = p_owner;
  else update gwiga_members set key_to = null, key_confirmed = false where id = p_owner; end if;
end $$;

-- 대리운전: 술자리가 끝난 뒤 기사를 만났을 때만
create or replace function public.gwiga_daeri_met(p_code text, p_member uuid, p_secret text)
returns void language plpgsql security definer set search_path = public as $$
declare m gwiga_members := gwiga_auth(p_code, p_member, p_secret);
begin
  if m.car <> 'y' or m.method <> '대리운전' then raise exception '대리운전으로 귀가하기로 한 사람만 누를 수 있습니다.'; end if;
  if not gwiga_ended(p_code) then raise exception '술자리가 끝난 뒤에 누를 수 있습니다.'; end if;
  update gwiga_members set daeri_met = true where id = m.id;
end $$;

-- 귀가 완료: 끝난 뒤, 미확인이 아닐 때만
create or replace function public.gwiga_go_home(p_code text, p_member uuid, p_secret text)
returns void language plpgsql security definer set search_path = public as $$
declare m gwiga_members := gwiga_auth(p_code, p_member, p_secret);
begin
  if not gwiga_ended(p_code) then raise exception '술자리가 끝난 뒤에 누를 수 있습니다.'; end if;
  if gwiga_status(m) in ('pending','key-wait') then raise exception '차가 확인되지 않아 귀가 완료를 누를 수 없습니다.'; end if;
  update gwiga_members set home = true where id = m.id;
end $$;

-- 총무 마무리: 끝난 뒤, 참가자가 있고, 미확인이 0명일 때만
create or replace function public.gwiga_close(p_code text, p_host_secret text)
returns void language plpgsql security definer set search_path = public as $$
declare r gwiga_rooms; n int;
begin
  select * into r from gwiga_rooms where code = p_code and host_hash = gwiga_hash(p_host_secret);
  if not found then raise exception '총무 확인에 실패했습니다.'; end if;
  if r.closed then return; end if;
  if now() < r.ends_at then raise exception '술자리가 끝난 뒤에 마무리할 수 있습니다.'; end if;
  if not exists (select 1 from gwiga_members where room_code = r.code) then raise exception '아직 참가한 사람이 없습니다.'; end if;
  select count(*) into n from gwiga_members m where m.room_code = r.code and gwiga_status(m) in ('pending','key-wait');
  if n > 0 then raise exception '확인되지 않은 차가 %대 남아 있어 마무리할 수 없습니다.', n; end if;
  update gwiga_rooms set closed = true where code = r.code;
end $$;

-- 총무가 모임 지우기
create or replace function public.gwiga_delete(p_code text, p_host_secret text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from gwiga_rooms where code = p_code and host_hash = gwiga_hash(p_host_secret);
  if not found then raise exception '총무 확인에 실패했습니다.'; end if;
end $$;

-- ---------------------------------------------------------------------
-- 실행 권한: 앱에서는 아래 함수만 부를 수 있다
-- ---------------------------------------------------------------------
revoke execute on function
  public.gwiga_hash(text), public.gwiga_status(public.gwiga_members), public.gwiga_purge(),
  public.gwiga_room_json(text), public.gwiga_auth(text, uuid, text), public.gwiga_ended(text),
  public.gwiga_create_room(text, date, text, text, timestamptz), public.gwiga_get_room(text),
  public.gwiga_join(text, text, text, text), public.gwiga_give_key(text, uuid, text, uuid),
  public.gwiga_cancel_key(text, uuid, text), public.gwiga_confirm_key(text, uuid, text, uuid, boolean),
  public.gwiga_daeri_met(text, uuid, text), public.gwiga_go_home(text, uuid, text),
  public.gwiga_close(text, text), public.gwiga_delete(text, text)
from public, anon, authenticated;

grant execute on function
  public.gwiga_create_room(text, date, text, text, timestamptz), public.gwiga_get_room(text),
  public.gwiga_join(text, text, text, text), public.gwiga_give_key(text, uuid, text, uuid),
  public.gwiga_cancel_key(text, uuid, text), public.gwiga_confirm_key(text, uuid, text, uuid, boolean),
  public.gwiga_daeri_met(text, uuid, text), public.gwiga_go_home(text, uuid, text),
  public.gwiga_close(text, text), public.gwiga_delete(text, text)
to anon, authenticated;
