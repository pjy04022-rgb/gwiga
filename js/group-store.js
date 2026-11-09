/* 모임 데이터 저장소
 *
 * 지금은 LocalStore(이 기기 안에서만 동작하는 시연판)만 있다.
 * 여러 사람이 각자 휴대폰으로 참가하려면 같은 함수 이름을 가진 서버 저장소
 * (예: Supabase)를 만들어 G.groupStore 에 넣으면 된다. 화면 코드(group.js)는 바꿀 필요 없다.
 *
 * 저장소가 지켜야 할 약속 (모든 함수는 Promise를 돌려준다)
 *   mode                      'local' | 'server'
 *   listRooms()               → 이 기기에서 만들었거나 참가한 방 목록
 *   createRoom({title,date,start,end,example}) → room  (이 기기가 총무가 됨: room.host = true)
 *   getRoom(code)             → room | null   (room.members 포함, room.me = 이 기기 참가자 id)
 *   addMember(code, {nick,method,car,example}) → member   (규칙 위반이면 {code:'invalid', errors:[...]}로 거부)
 *   updateMember(code, id, patch) → member
 *   closeRoom(code)           → room  (마무리 조건을 서버에서도 다시 확인할 것)
 *   deleteRoom(code)
 *   subscribe(fn)             → 데이터가 바뀌면 fn() 호출, 해제 함수를 돌려줌
 *
 * 개인정보: 별명·귀가 방법·차 여부만 저장한다. 방은 끝난 시각 24시간 뒤 지운다.
 */
(function () {
  var G = window.Gwiga, L = window.GwigaGroup;
  var KEY = 'gwiga-groups-v1';
  var KEEP_MS = 24 * 3600000;
  var listeners = [];

  function load() {
    var d = G.store.get(KEY);
    if (!d || typeof d !== 'object' || !d.rooms) d = { rooms: {} };
    var now = Date.now(), changed = false;
    Object.keys(d.rooms).forEach(function (c) {
      if (L.endAt(d.rooms[c]) + KEEP_MS < now) { delete d.rooms[c]; changed = true; }
    });
    if (changed) G.store.set(KEY, d);
    return d;
  }
  function save(d) { G.store.set(KEY, d); notify(); }
  function notify() { listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} }); }
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function fail(msg) { return Promise.reject({ code: 'invalid', errors: [msg] }); }

  var ALLOWED = ['keyTo', 'keyConfirmed', 'daeriMet', 'home', 'method', 'car'];

  var Local = {
    mode: 'local',

    listRooms: function () {
      var rooms = Object.keys(load().rooms).map(function (c) { return copy(load().rooms[c]); });
      rooms.sort(function (a, b) { return b.createdAt - a.createdAt; });
      return Promise.resolve(rooms);
    },

    createRoom: function (data) {
      var d = load(), code;
      do { code = L.makeCode(); } while (d.rooms[code]);
      var title = L.cleanNick(data.title).slice(0, 30) || '술자리';
      var room = { code: code, title: title, date: data.date, start: data.start, end: data.end,
        createdAt: Date.now(), host: true, me: null, closed: false, example: !!data.example, members: [] };
      d.rooms[code] = room; save(d);
      return Promise.resolve(copy(room));
    },

    getRoom: function (code) {
      var r = load().rooms[code];
      return Promise.resolve(r ? copy(r) : null);
    },

    addMember: function (code, data) {
      var d = load(), r = d.rooms[code];
      if (!r) return fail('모임을 찾을 수 없습니다.');
      if (r.closed) return fail('이미 마무리된 모임입니다.');
      var errs = L.validateJoin(data, r.members);
      if (errs.length) return Promise.reject({ code: 'invalid', errors: errs });
      var m = { id: uid(), nick: L.cleanNick(data.nick), method: data.method, car: data.car,
        keyTo: null, keyConfirmed: false, daeriMet: false, home: false, joinedAt: Date.now(), example: !!data.example };
      r.members.push(m);
      if (!data.example) r.me = m.id;
      save(d);
      return Promise.resolve(copy(m));
    },

    updateMember: function (code, id, patch) {
      var d = load(), r = d.rooms[code];
      if (!r) return fail('모임을 찾을 수 없습니다.');
      var m = r.members.filter(function (x) { return x.id === id; })[0];
      if (!m) return fail('참가자를 찾을 수 없습니다.');
      Object.keys(patch).forEach(function (k) { if (ALLOWED.indexOf(k) >= 0) m[k] = patch[k]; });
      if ('keyTo' in patch) m.keyConfirmed = false;          // 맡길 사람을 바꾸면 확인을 다시 받는다
      if (patch.home && L.isUnresolved(L.status(Object.assign({}, m, { home: false })))) m.home = false; // 미확인은 귀가 완료 불가
      save(d);
      return Promise.resolve(copy(m));
    },

    closeRoom: function (code) {
      var d = load(), r = d.rooms[code];
      if (!r) return fail('모임을 찾을 수 없습니다.');
      r.closed = true; save(d);
      return Promise.resolve(copy(r));
    },

    deleteRoom: function (code) {
      var d = load(); delete d.rooms[code]; save(d);
      return Promise.resolve();
    },

    subscribe: function (fn) {
      listeners.push(fn);
      function onStorage(e) { if (e.key === KEY) fn(); }   // 같은 기기의 다른 탭
      window.addEventListener('storage', onStorage);
      return function () {
        listeners = listeners.filter(function (x) { return x !== fn; });
        window.removeEventListener('storage', onStorage);
      };
    }
  };

  G.groupStore = Local;
})();
