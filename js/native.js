/* 설치형 앱(안드로이드, Capacitor)에서만 쓰는 기능 — util.js 다음에 불러온다.
 * 웹 브라우저에서는 G.native가 null이라 아무것도 바뀌지 않는다.
 * 앱에서는 브라우저 기능 대신 휴대폰 기능을 쓴다: 공유 창, 파일 내보내기, 앱을 꺼 두어도 울리는 알림.
 * 알림을 쓰는 화면은 이 파일을 직접 부르지 않고 js/alarms.js(G.alarms)를 거친다.
 */
(function () {
  var G = window.Gwiga;
  var C = window.Capacitor;

  /* 참가 링크에 쓰는 공개 주소. 앱 안의 주소(https://localhost)는 다른 사람이 열 수 없다. */
  G.webUrl = 'https://pjy04022-rgb.github.io/gwiga/';
  G.apkUrl = 'https://github.com/pjy04022-rgb/gwiga/releases/latest/download/gwiga.apk';
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

  /* 화면 위에 바로 뜨는(헤드업) 중요 알림 채널. 안드로이드 8 이상에서 채널 중요도가 팝업 여부를 정한다. */
  var CHANNEL = 'gwiga-alerts';
  var channelReady = call('LocalNotifications', 'createChannel', {
    id: CHANNEL, name: '귀가 약속 알림', description: '술자리 끝날 시간, 운전 전 숙취 확인, 모임 확인 알림',
    importance: 5, visibility: 1, vibration: true, lights: true, lightColor: '#E8A33D'
  }).catch(function () {});

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
    /* 정확한 시각 알림(안드로이드 12+): 'granted' | 'denied'. 확인할 수 없으면 'granted'로 본다 */
    exactState: function () {
      return call('LocalNotifications', 'checkExactNotificationSetting')
        .then(function (r) { return r.exact_alarm || 'granted'; }, function () { return 'granted'; });
    },
    exactOpenSettings: function () {
      return call('LocalNotifications', 'changeExactNotificationSetting')
        .then(function (r) { return r.exact_alarm || 'granted'; });
    },

    /* 알림 예약: ids = 지울 번호들, items = [{ id, title, body, at: Date, extra }] — 앱을 꺼 두어도 울린다 */
    schedule: function (ids, items) {
      return channelReady.then(function () {
        return call('LocalNotifications', 'cancel', { notifications: ids.map(function (id) { return { id: id }; }) }).catch(function () {});
      }).then(function () {
        var list = (items || []).filter(function (n) { return n.at.getTime() > Date.now(); }).map(function (n) {
          return { id: n.id, title: n.title, body: n.body, largeBody: n.body, channelId: CHANNEL,
            smallIcon: 'ic_stat_gwiga', iconColor: '#E8A33D', autoCancel: true, extra: n.extra || null,
            schedule: { at: n.at.toISOString(), allowWhileIdle: true } };
        });
        if (list.length) return call('LocalNotifications', 'schedule', { notifications: list });
      });
    },

    /* 알림을 눌러 앱을 열었을 때 (extra.hash로 그 화면을 연다) */
    onTap: function (fn) {
      var P = C.Plugins && C.Plugins.LocalNotifications;
      if (P && typeof P.addListener === 'function') {
        try { P.addListener('localNotificationActionPerformed', function (a) { fn((a && a.notification && a.notification.extra) || {}); }); } catch (e) {}
      }
    }
  };
})();
