/* 설치형 앱(안드로이드, Capacitor)에서만 쓰는 기능 — util.js 다음에 불러온다.
 * 웹 브라우저에서는 G.native가 null이라 아무것도 바뀌지 않는다.
 * 앱에서는 브라우저 기능 대신 휴대폰 기능을 쓴다: 공유 창, 파일 내보내기, 앱을 꺼 두어도 울리는 알림.
 */
(function () {
  var G = window.Gwiga;
  var C = window.Capacitor;

  /* 참가 링크에 쓰는 공개 주소. 앱 안의 주소(https://localhost)는 다른 사람이 열 수 없다. */
  G.webUrl = 'https://pjy04022-rgb.github.io/gwiga/';
  G.native = null;
  if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform() || typeof C.nativePromise !== 'function') return;

  function call(plugin, method, opts) { return C.nativePromise(plugin, method, opts || {}); }

  function toBase64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1] || ''); };
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  /* 공유 창을 닫은 것은 실패로 치지 않는다 */
  function ignoreCancel(err) {
    if (err && /cancel/i.test(String(err.message || err))) return { status: 'cancelled' };
    throw err;
  }

  var END_ID = 1, DRIVE_ID = 2;

  G.native = {
    /* 글·링크 공유 */
    share: function (o) {
      return call('Share', 'share', { title: o.title || '', text: o.text || '', url: o.url || undefined, dialogTitle: o.title || '공유' }).catch(ignoreCancel);
    },
    /* 파일을 앱 임시 폴더에 쓴 뒤 공유 창으로 내보내기 (카드 이미지, 캘린더 파일) */
    shareFile: function (filename, blob, text) {
      return toBase64(blob).then(function (data) {
        return call('Filesystem', 'writeFile', { path: filename, data: data, directory: 'CACHE' });
      }).then(function (w) {
        return call('Share', 'share', { text: text || undefined, files: [w.uri], dialogTitle: filename });
      }).catch(ignoreCancel);
    },
    /* 알림 권한: 'granted' | 'denied' | 'prompt' */
    notifyState: function () {
      return call('LocalNotifications', 'checkPermissions').then(function (r) { return r.display; });
    },
    notifyAsk: function () {
      return call('LocalNotifications', 'requestPermissions').then(function (r) { return r.display; });
    },
    /* 알림 예약: list = [{ kind: 'end'|'drive', title, body, at: Date }] — 앱을 꺼 두어도 울린다 */
    setAlarms: function (list) {
      return call('LocalNotifications', 'cancel', { notifications: [{ id: END_ID }, { id: DRIVE_ID }] }).catch(function () {}).then(function () {
        var items = (list || []).filter(function (n) { return n.at.getTime() > Date.now(); }).map(function (n) {
          return { id: n.kind === 'drive' ? DRIVE_ID : END_ID, title: n.title, body: n.body,
            schedule: { at: n.at.toISOString(), allowWhileIdle: true } };
        });
        if (items.length) return call('LocalNotifications', 'schedule', { notifications: items });
      });
    }
  };
})();
