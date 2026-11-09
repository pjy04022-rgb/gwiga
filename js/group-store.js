/* 모임 데이터 저장소
 *
 * 두 가지가 있고, js/config.js에 서버 설정이 있으면 서버 저장소를 쓴다.
 *   ServerStore  Supabase 함수(supabase/schema.sql)를 부른다. 친구들이 각자 휴대폰으로 참가.
 *   LocalStore   이 기기 안에서만 동작하는 시연판(서버 설정이 없을 때, 개발·발표 시연용).
 *
 * 저장소 약속 (모든 함수는 Promise를 돌려준다. 실패하면 {code, errors:[문구]}로 거부)
 *   mode                         'server' | 'local'
 *   listRooms()                  → 이 기기에서 만들었거나 참가한 모임 목록
 *   createRoom({title,date,start,end}) → room   (이 기기가 총무가 됨)
 *   getRoom(code)                → room | null
 *       room = {code,title,date,start,end,endsAt?,closed,host,me,example,members:[...] , skew?}
 *       member = {id,nick,method,car,keyTo,keyConfirmed,daeriMet,home,joinedAt}
 *   join(code, {nick,method,car}) → member      (이 기기가 그 참가자가 됨)
 *   giveKey(code, actorId, targetId) / cancelKey(code, actorId)
 *   confirmKey(code, actorId, ownerId, ok) / daeriMet(code, actorId) / goHome(code, actorId)
 *   close(code) / remove(code)                  (총무만)
 *   watch(code|null)             보고 있는 모임을 주기적으로 새로 고침(서버)
 *   subscribe(fn)                데이터가 바뀌면 fn()
 *
 * actorId: 서버 저장소는 이 기기의 참가자만 행동할 수 있다(다르면 거부).
 *          시연판은 화면 전환으로 고른 참가자로 행동한다.
 */
(function () {
  var G = window.Gwiga, L = window.GwigaGroup;
  var listeners = [];
  function notify() { listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} }); }
  function subscribe(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (x) { return x !== fn; }); };
  }
  function fail(msg, code) { return Promise.reject({ code: code || 'invalid', errors: [msg] }); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  /* =========================== 서버 저장소 =========================== */
  function makeServerStore(cfg) {
    var base = cfg.supabaseUrl.replace(/\/+$/, '') + '/rest/v1/rpc/';
    var MINE = 'gwiga-mine-v1';      // 이 기기의 모임 열쇠: {코드: {host, memberId, memberSecret}}
    var watched = null, lastJson = {}, timer = null;

    function mine() { return G.store.get(MINE) || {}; }
    function setMine(code, patch) { var m = mine(); m[code] = Object.assign(m[code] || {}, patch); G.store.set(MINE, m); }
    function dropMine(code) { var m = mine(); delete m[code]; G.store.set(MINE, m); }

    function rpc(fn, args) {
      var headers = { 'Content-Type': 'application/json', apikey: cfg.supabaseKey };
      if (!/^sb_/.test(cfg.supabaseKey)) headers.Authorization = 'Bearer ' + cfg.supabaseKey;
      return fetch(base + fn, { method: 'POST', headers: headers, body: JSON.stringify(args || {}) }).then(function (res) {
        return res.text().then(function (txt) {
          var body = null;
          try { body = txt ? JSON.parse(txt) : null; } catch (e) {}
          if (res.ok) return body;
          var msg = (body && body.message) || '';
          if (!/[가-힣]/.test(msg)) msg = '서버에서 요청을 처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.';
          return Promise.reject({ code: 'invalid', errors: [msg] });
        });
      }, function () {
        return Promise.reject({ code: 'network', errors: ['인터넷 연결을 확인해 주세요.'] });
      });
    }

    function shape(code, data) {
      if (!data) return null;
      var m = mine()[code] || {};
      var memberIds = data.members.map(function (x) { return x.id; });
      return {
        code: data.code, title: data.title, date: data.date, start: data.start, end: data.end,
        endsAt: data.endsAt, closed: data.closed, example: false,
        host: !!m.host, me: m.memberId && memberIds.indexOf(m.memberId) >= 0 ? m.memberId : null,
        skew: data.serverNow ? Date.parse(data.serverNow) - Date.now() : 0,
        members: data.members
      };
    }

    function getRoom(code) {
      return rpc('gwiga_get_room', { p_code: code }).then(function (data) {
        lastJson[code] = JSON.stringify(data);
        if (!data) { var m = mine(); if (m[code]) dropMine(code); }
        return shape(code, data);
      });
    }

    function me(code, actorId) {
      var m = mine()[code];
      if (!m || !m.memberId) return null;
      if (actorId && actorId !== m.memberId) return null;
      return m;
    }
    function act(fn, code, actorId, extra) {
      var m = me(code, actorId);
      if (!m) return fail('이 기기에서 참가한 사람만 할 수 있습니다.');
      return rpc(fn, Object.assign({ p_code: code, p_member: m.memberId, p_secret: m.memberSecret }, extra || {}))
        .then(function () { return refresh(code); });
    }
    function refresh(code) { return getRoom(code).then(function (r) { notify(); return r; }); }

    function poll() {
      if (!watched || document.hidden) return;
      var code = watched;
      rpc('gwiga_get_room', { p_code: code }).then(function (data) {
        var j = JSON.stringify(data);
        if (j !== lastJson[code]) { lastJson[code] = j; notify(); }
      }, function () {});
    }

    return {
      mode: 'server',
      listRooms: function () {
        var codes = Object.keys(mine());
        return Promise.all(codes.map(function (c) {
          return getRoom(c).catch(function () { return null; });
        })).then(function (rooms) {
          return rooms.filter(Boolean).sort(function (a, b) { return Date.parse(b.endsAt) - Date.parse(a.endsAt); });
        });
      },
      createRoom: function (d) {
        var endsAt = new Date(L.endAt(d)).toISOString();
        return rpc('gwiga_create_room', { p_title: d.title, p_date: d.date, p_start: d.start, p_end: d.end, p_ends_at: endsAt })
          .then(function (res) { setMine(res.code, { host: res.hostSecret }); return getRoom(res.code); });
      },
      getRoom: getRoom,
      join: function (code, d) {
        return rpc('gwiga_join', { p_code: code, p_nick: d.nick, p_method: d.method, p_car: d.car }).then(function (res) {
          setMine(code, { memberId: res.id, memberSecret: res.secret });
          return refresh(code).then(function (r) { return r.members.filter(function (x) { return x.id === res.id; })[0]; });
        });
      },
      giveKey: function (code, actorId, targetId) { return act('gwiga_give_key', code, actorId, { p_target: targetId }); },
      cancelKey: function (code, actorId) { return act('gwiga_cancel_key', code, actorId); },
      confirmKey: function (code, actorId, ownerId, ok) { return act('gwiga_confirm_key', code, actorId, { p_owner: ownerId, p_ok: !!ok }); },
      daeriMet: function (code, actorId) { return act('gwiga_daeri_met', code, actorId); },
      goHome: function (code, actorId) { return act('gwiga_go_home', code, actorId); },
      close: function (code) {
        var m = mine()[code];
        if (!m || !m.host) return fail('총무만 마무리할 수 있습니다.');
        return rpc('gwiga_close', { p_code: code, p_host_secret: m.host }).then(function () { return refresh(code); });
      },
      remove: function (code) {
        var m = mine()[code];
        if (!m || !m.host) return fail('총무만 지울 수 있습니다.');
        return rpc('gwiga_delete', { p_code: code, p_host_secret: m.host }).then(function () { dropMine(code); notify(); });
      },
      watch: function (code) {
        watched = code;
        clearInterval(timer);
        if (code) timer = setInterval(poll, 5000);
      },
      subscribe: subscribe
    };
  }

  /* ====================== 이 기기 저장소 (시연판) ====================== */
  function makeLocalStore() {
    var KEY = 'gwiga-groups-v1', KEEP_MS = 24 * 3600000;

    function load() {
      var d = G.store.get(KEY);
      if (!d || typeof d !== 'object' || !d.rooms) d = { rooms: {} };
      var now = Date.now(), changed = false;
      Object.keys(d.rooms).forEach(function (c) { if (L.endAt(d.rooms[c]) + KEEP_MS < now) { delete d.rooms[c]; changed = true; } });
      if (changed) G.store.set(KEY, d);
      return d;
    }
    function save(d) { G.store.set(KEY, d); notify(); }
    function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
    function withMember(code, id, fn) {
      var d = load(), r = d.rooms[code];
      if (!r) return fail('모임을 찾을 수 없습니다.');
      if (r.closed) return fail('이미 마무리된 모임입니다.');
      var m = r.members.filter(function (x) { return x.id === id; })[0];
      if (!m) return fail('참가자를 찾을 수 없습니다.');
      var err = fn(m, r);
      if (err) return fail(err);
      save(d);
      return Promise.resolve(copy(r));
    }
    function ended(r) { return Date.now() >= L.endAt(r) || !!r.simEnded; }

    window.addEventListener('storage', function (e) { if (e.key === KEY) notify(); });

    return {
      mode: 'local',
      listRooms: function () {
        var rooms = load().rooms;
        return Promise.resolve(Object.keys(rooms).map(function (c) { return copy(rooms[c]); }).sort(function (a, b) { return b.createdAt - a.createdAt; }));
      },
      createRoom: function (data) {
        var d = load(), code;
        do { code = L.makeCode(); } while (d.rooms[code]);
        var room = { code: code, title: L.cleanNick(data.title).slice(0, 30) || '술자리', date: data.date, start: data.start, end: data.end,
          createdAt: Date.now(), host: true, me: null, closed: false, example: !!data.example, simEnded: false, members: [] };
        d.rooms[code] = room; save(d);
        return Promise.resolve(copy(room));
      },
      getRoom: function (code) { var r = load().rooms[code]; return Promise.resolve(r ? copy(r) : null); },
      join: function (code, data) {
        var d = load(), r = d.rooms[code];
        if (!r) return fail('모임을 찾을 수 없습니다.');
        if (r.closed) return fail('이미 마무리된 모임입니다.');
        var errs = L.validateJoin(data, r.members);
        if (errs.length) return Promise.reject({ code: 'invalid', errors: errs });
        var m = { id: uid(), nick: L.cleanNick(data.nick), method: data.method, car: data.car,
          keyTo: null, keyConfirmed: false, daeriMet: false, home: false, joinedAt: Date.now() };
        r.members.push(m);
        if (!data.example) r.me = m.id;
        save(d);
        return Promise.resolve(copy(m));
      },
      giveKey: function (code, actorId, targetId) {
        return withMember(code, actorId, function (m, r) {
          if (m.car !== 'y') return '차를 가져온 사람만 키를 맡길 수 있습니다.';
          if (targetId === m.id || !r.members.some(function (x) { return x.id === targetId; })) return '키는 이 모임의 다른 친구에게 맡겨 주세요.';
          m.keyTo = targetId; m.keyConfirmed = false;
        });
      },
      cancelKey: function (code, actorId) { return withMember(code, actorId, function (m) { if (!m.home) { m.keyTo = null; m.keyConfirmed = false; } }); },
      confirmKey: function (code, actorId, ownerId, ok) {
        return withMember(code, actorId, function (m, r) {
          var o = r.members.filter(function (x) { return x.id === ownerId && x.keyTo === m.id; })[0];
          if (!o) return '나에게 키를 맡긴 요청이 없습니다.';
          if (ok) o.keyConfirmed = true; else { o.keyTo = null; o.keyConfirmed = false; }
        });
      },
      daeriMet: function (code, actorId) {
        return withMember(code, actorId, function (m, r) {
          if (m.car !== 'y' || m.method !== '대리운전') return '대리운전으로 귀가하기로 한 사람만 누를 수 있습니다.';
          if (!ended(r)) return '술자리가 끝난 뒤에 누를 수 있습니다.';
          m.daeriMet = true;
        });
      },
      goHome: function (code, actorId) {
        return withMember(code, actorId, function (m, r) {
          if (!ended(r)) return '술자리가 끝난 뒤에 누를 수 있습니다.';
          if (L.isUnresolved(L.status(m))) return '차가 확인되지 않아 귀가 완료를 누를 수 없습니다.';
          m.home = true;
        });
      },
      close: function (code) {
        var d = load(), r = d.rooms[code];
        if (!r) return fail('모임을 찾을 수 없습니다.');
        var block = L.closeBlock(r.members, ended(r));
        if (block) return fail(block);
        r.closed = true; save(d);
        return Promise.resolve(copy(r));
      },
      remove: function (code) { var d = load(); delete d.rooms[code]; save(d); return Promise.resolve(); },
      /* 시연 전용: 끝난 것으로 보기 */
      setSimEnded: function (code, on) { var d = load(); if (d.rooms[code]) { d.rooms[code].simEnded = !!on; save(d); } return Promise.resolve(); },
      watch: function () {},
      subscribe: subscribe
    };
  }

  var cfg = window.GWIGA_CONFIG || {};
  var useServer = !!(cfg.supabaseUrl && cfg.supabaseKey) && !G.inArtifact;
  G.groupStore = useServer ? makeServerStore(cfg) : makeLocalStore();
})();
