/* 알림 — 술자리 계획(plan.js)과 모임(group.js)이 함께 쓴다. native.js 다음에 불러온다.
 *
 *   설치형 앱: 휴대폰에 예약해 두어 앱을 꺼 두어도 정확한 시각에 화면 위로 뜬다.
 *   웹:        앱(탭)이 열려 있는 동안만 울린다. 그래서 캘린더 추가와 안드로이드 앱을 함께 안내한다.
 *
 * G.alarms.set(key, items)  key = 'plan' | 'room-코드', items = [{ title, body, at: Date, hash }]
 *   같은 key로 다시 부르면 이전 예약을 지우고 새로 건다. items가 비면 지우기만 한다.
 *   알림이 꺼져 있으면 아무것도 걸지 않는다. 켜고 끌 때 onChange로 알려 주므로 화면이 다시 건다.
 */
(function () {
  var G = window.Gwiga, N = G.native;
  var PREF = 'gwiga-notify-v1';            // true 켬, false 사용자가 끔, null 아직 정하지 않음
  var supported = !!N || ('Notification' in window && !G.inArtifact);
  var perm = 'prompt', exact = 'granted';
  var timers = {}, listeners = [];

  function webPerm() { return supported && !N ? (Notification.permission === 'default' ? 'prompt' : Notification.permission) : 'denied'; }
  if (!N) perm = webPerm();

  function emit() { listeners.slice().forEach(function (fn) { try { fn(); } catch (e) {} }); }
  function enabled() { return supported && perm === 'granted' && G.store.get(PREF) !== false; }

  function refresh() {
    if (!N) { perm = webPerm(); emit(); return Promise.resolve(); }
    return Promise.all([N.notifyState(), N.exactState()]).then(function (r) { perm = r[0]; exact = r[1]; emit(); }, function () {});
  }

  /* 예약 번호: 계획은 1·2·3, 모임은 코드마다 3개씩 */
  function idsFor(key) {
    if (key === 'plan') return [1, 2, 3];
    var h = 0;
    for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 40000;
    var base = 1000 + h * 3;
    return [base, base + 1, base + 2];
  }

  function fireWeb(item) {
    var opts = { body: item.body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'gwiga-' + (item.hash || 'plan'),
      requireInteraction: true, data: { hash: item.hash || 'plan' } };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(function (reg) { reg.showNotification(item.title, opts); });
    } else {
      try { var n = new Notification(item.title, opts); n.onclick = function () { window.focus(); location.hash = item.hash || 'plan'; }; } catch (e) {}
    }
  }

  function set(key, items) {
    items = enabled() ? (items || []) : [];
    if (N) {
      var ids = idsFor(key);
      var list = items.slice(0, ids.length).map(function (it, i) {
        return { id: ids[i], title: it.title, body: it.body, at: it.at, extra: { hash: it.hash || 'plan' } };
      });
      return N.schedule(ids, list).catch(function () {});
    }
    (timers[key] || []).forEach(clearTimeout);
    timers[key] = [];
    items.forEach(function (it) {
      var ms = it.at.getTime() - Date.now();
      if (ms > 0 && ms < 24 * 3600000) timers[key].push(setTimeout(function () { fireWeb(it); }, ms));
    });
    return Promise.resolve();
  }

  G.alarms = {
    supported: supported,
    persistent: !!N,                        // 앱을 꺼 두어도 울리는가
    state: function () { return perm; },    // 'granted' | 'denied' | 'prompt'
    exact: function () { return exact; },   // 앱: 정확한 시각 알림 허용 여부
    enabled: enabled,
    userOff: function () { return G.store.get(PREF) === false; },
    /* 사용자가 누른 순간에만 부른다 (권한 창) */
    ask: function () {
      if (!supported) return Promise.resolve('denied');
      var p = N ? N.notifyAsk() : Notification.requestPermission();
      return Promise.resolve(p).then(function (res) {
        perm = res === 'default' ? 'prompt' : res;
        if (perm === 'granted') G.store.set(PREF, true);
        return (N ? N.exactState().then(function (e) { exact = e; }) : Promise.resolve()).then(function () { emit(); return perm; });
      }, function () { return 'denied'; });
    },
    turnOff: function () { G.store.set(PREF, false); emit(); },
    turnOn: function () { if (perm === 'granted') { G.store.set(PREF, true); emit(); return Promise.resolve(perm); } return this.ask(); },
    openExactSettings: function () { return N ? N.exactOpenSettings().then(refresh, refresh) : Promise.resolve(); },
    set: set,
    refresh: refresh,
    onChange: function (fn) { listeners.push(fn); }
  };

  if (N) {
    refresh();
    N.onTap(function (extra) { if (extra && extra.hash) location.hash = extra.hash; });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
})();
