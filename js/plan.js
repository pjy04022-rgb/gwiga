/* 술자리 계획 · 종료 알림 · 캘린더 */
(function () {
  var G = window.Gwiga, $ = G.$;
  var KEY = 'gwiga-plan-v1', DISMISS = 'gwiga-dismiss-v1', NOTIFY = 'gwiga-notify-v1';
  var saved = G.store.get(KEY);
  var editing = false;
  var notifyTimer = null;

  /* ---------- 데이터 ---------- */
  function readForm() {
    return {
      date: $('p-date').value || G.todayStr(),
      start: $('p-start').value || '19:00',
      end: $('p-end').value || '23:00',
      car: document.querySelector('input[name=car]:checked').value,
      method: document.querySelector('input[name=method]:checked').value,
      memo: $('p-memo').value.trim(),
      drv: document.querySelector('input[name=drv]:checked').value,
      drive: $('p-drive').value || '08:00'
    };
  }
  function fillForm(p) {
    $('p-date').value = p.date; $('p-start').value = p.start; $('p-end').value = p.end;
    $('car-' + p.car).checked = true;
    var m = document.querySelector('input[name=method][value="' + p.method + '"]');
    if (m) m.checked = true;
    $('p-memo').value = p.memo || '';
    $('drv-' + p.drv).checked = true; $('p-drive').value = p.drive;
    syncForm();
  }
  function endDate(p) {
    var s = new Date(p.date + 'T' + p.start), e = new Date(p.date + 'T' + p.end);
    if (e <= s) e.setDate(e.getDate() + 1);
    return e;
  }
  function driveDate(p) {
    var e = endDate(p), d = new Date(e), t = p.drive.split(':');
    d.setHours(+t[0], +t[1], 0, 0);
    if (d <= e) d.setDate(d.getDate() + 1);
    return d;
  }

  /* ---------- 문구 ---------- */
  function phrase(m) {
    if (m === '근처 숙소') return '근처에서 자고 가기';
    if (m === '가족 차') return '가족 차를 타고';
    if (m === '걸어서') return '걸어서';
    return m + G.ro(m);
  }
  function bigLine(m) {
    if (m === '근처 숙소') return '오늘은 <em>근처에서 자고</em><br>차는 몰지 않습니다';
    if (m === '가족 차') return '오늘은 <em>가족 차</em>로<br>귀가합니다';
    if (m === '걸어서') return '오늘은 <em>걸어서</em><br>귀가합니다';
    return '오늘은 <em>' + m + '</em>' + G.ro(m) + '<br>귀가합니다';
  }
  function eventTitle(p) { return '귀가약속: ' + (p.method === '근처 숙소' ? '근처에서 자고 가기' : phrase(p.method) + ' 귀가'); }
  function eventDetail(p) {
    return '맑은 정신일 때 정한 약속입니다. 차는 몰지 않습니다.' +
      (p.memo ? '\n메모: ' + p.memo : '') +
      (p.drv === 'y' ? '\n내일 ' + p.drive + ' 운전 예정: 운전 전에 숙취 계산기로 확인하세요.' : '');
  }

  /* ---------- 캘린더 ---------- */
  function utc(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function gcalUrl(p) {
    var e = endDate(p), e2 = new Date(e.getTime() + 15 * 60000);
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(eventTitle(p)) +
      '&dates=' + utc(e) + '/' + utc(e2) + '&details=' + encodeURIComponent(eventDetail(p));
  }
  function icsEsc(s) { return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function vevent(uid, start, mins, title, desc) {
    var end = new Date(start.getTime() + mins * 60000);
    return ['BEGIN:VEVENT', 'UID:' + uid + '@gwiga', 'DTSTAMP:' + utc(new Date()), 'DTSTART:' + utc(start), 'DTEND:' + utc(end),
      'SUMMARY:' + icsEsc(title), 'DESCRIPTION:' + icsEsc(desc),
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(title), 'END:VALARM', 'END:VEVENT'];
  }
  function buildIcs(p) {
    var stamp = Date.now().toString(36);
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gwiga//KO', 'CALSCALE:GREGORIAN']
      .concat(vevent('end-' + stamp, endDate(p), 15, eventTitle(p), eventDetail(p)));
    if (p.drv === 'y') {
      var before = new Date(driveDate(p).getTime() - 30 * 60000);
      lines = lines.concat(vevent('drive-' + stamp, before, 15, '운전 전 숙취 확인',
        '어젯밤 술자리 뒤 ' + p.drive + '에 운전할 예정입니다. 알코올이 남아 있을 수 있으니 숙취 계산기로 확인하고, 조금이라도 의심되면 운전하지 마세요.'));
    }
    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  /* ---------- 앱 알림 ----------
   * 웹: 앱이 켜져 있을 때만 울린다.
   * 설치형 앱(G.native): 휴대폰에 예약해 두어 앱을 꺼 두어도 울린다. 다음 날 운전 예정이면 운전 30분 전에도 알린다.
   */
  var NATIVE = G.native;
  var canNotify = !!NATIVE || ('Notification' in window && !G.inArtifact);
  var nativePerm = 'prompt';
  function perm() { return NATIVE ? nativePerm : Notification.permission; }
  function notifyLabel() {
    if (!canNotify) return;
    var on = G.store.get(NOTIFY) && perm() === 'granted';
    $('pr-notify').classList.toggle('done', !!on);
    $('pr-notify').querySelector('b').textContent = on ? '앱 알림 켜짐' : '앱 알림 켜기';
    $('pr-notify-sub').textContent = perm() === 'denied'
      ? (NATIVE ? '휴대폰 설정에서 알림이 막혀 있습니다' : '브라우저 설정에서 알림이 막혀 있습니다')
      : NATIVE ? (on ? '앱을 꺼 두어도 끝날 시간에 알립니다' : '앱을 꺼 두어도 끝날 시간에 알려 줍니다')
      : (on ? '앱이 켜져 있으면 끝날 시간에 알립니다' : '앱이 켜져 있을 때 끝날 시간에 알립니다');
  }
  var NOTIFY_TITLE = '술자리 끝날 시간입니다';
  function notifyBody(p) {
    return '오늘은 ' + (p.method === '근처 숙소' ? '근처에서 자고 가기로 했습니다.' : phrase(p.method) + ' 귀가하기로 했습니다.') + ' 맑은 정신일 때 정한 약속입니다.';
  }
  function nativeAlarms(p) {
    var list = [{ kind: 'end', title: NOTIFY_TITLE, body: notifyBody(p), at: endDate(p) }];
    if (p.drv === 'y') list.push({ kind: 'drive', title: '운전 전 숙취 확인',
      body: '어젯밤 술자리 뒤 ' + p.drive + '에 운전할 예정입니다. 알코올이 남아 있을 수 있으니 숙취 계산기로 확인하고, 조금이라도 의심되면 운전하지 마세요.',
      at: new Date(driveDate(p).getTime() - 30 * 60000) });
    return list;
  }
  function fireNotification(p) {
    var title = NOTIFY_TITLE;
    var body = notifyBody(p);
    var opts = { body: body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'gwiga-end' };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(function (reg) { reg.showNotification(title, opts); });
    } else {
      try { new Notification(title, opts); } catch (e) {}
    }
  }
  function scheduleNotify() {
    clearTimeout(notifyTimer);
    var on = canNotify && saved && G.store.get(NOTIFY) && perm() === 'granted';
    if (NATIVE) { NATIVE.setAlarms(on ? nativeAlarms(saved) : []).catch(function () {}); return; }
    if (!on) return;
    var ms = endDate(saved).getTime() - Date.now();
    if (ms > 0 && ms < 24 * 3600000) notifyTimer = setTimeout(function () { fireNotification(saved); checkAlert(); }, ms);
  }

  /* ---------- 종료 알림 화면 ---------- */
  function showAlert(p) {
    $('al-title').textContent = p.method === '근처 숙소' ? '오늘은 근처에서 자고 가기로 했습니다' : '오늘은 ' + phrase(p.method) + ' 귀가하기로 했습니다';
    $('al-text').textContent = (p.car === 'y' ? '차는 두고 가세요. ' : '') + '맑은 정신일 때 정한 약속입니다. 지금 기분이 괜찮아도 판단력은 이미 흐려져 있을 수 있습니다.';
    $('al-memo').hidden = !p.memo; $('al-memo').textContent = p.memo || '';
    $('al-check').hidden = p.drv !== 'y';
    $('alert').hidden = false;
  }
  function checkAlert() {
    if (!saved) { $('alert').hidden = true; return; }
    var e = endDate(saved), now = Date.now();
    if (now >= e.getTime() && now < e.getTime() + 6 * 3600000 && G.store.get(DISMISS) !== e.toISOString()) showAlert(saved);
  }

  /* ---------- 화면 ---------- */
  function syncForm() {
    var p = readForm();
    $('car-warn').hidden = !(p.car === 'y' && p.method !== '대리운전');
    $('p-drive').disabled = p.drv !== 'y';
  }
  function render() {
    var showSaved = !!saved && !editing;
    $('plan-saved').hidden = !showSaved;
    $('plan-edit').hidden = showSaved;
    $('p-cancel').hidden = !saved;
    if (!saved) return;
    var p = saved;
    $('pr-big').innerHTML = bigLine(p.method);
    $('pr-date').textContent = G.korDate(p.date);
    $('pr-end').textContent = p.end;
    $('pr-car').textContent = p.car === 'y' ? (p.method === '대리운전' ? '대리운전' : '가져감') : '두고 감';
    $('pr-memo').hidden = !p.memo; $('pr-memo').textContent = '메모 · ' + p.memo;
    $('pr-drive').hidden = p.drv !== 'y';
    $('pr-drive').textContent = '다음 날 ' + p.drive + ' 운전 예정 · 알코올이 남아 있을 수 있으니 운전 전에 숙취 계산기로 확인하세요.';
    $('pr-gcal').href = gcalUrl(p);
    $('pr-ics').hidden = G.inArtifact;
    $('pr-notify').hidden = !canNotify;
    notifyLabel();
  }

  /* ---------- 이벤트 ---------- */
  $('plan-form').addEventListener('change', syncForm);
  $('plan-form').addEventListener('input', syncForm);
  $('plan-form').addEventListener('submit', function (e) {
    e.preventDefault();
    saved = readForm();
    G.store.set(KEY, saved); G.store.set(DISMISS, null);
    editing = false; render(); checkAlert(); scheduleNotify();
    G.toast('약속을 저장했습니다.');
    window.scrollTo(0, 0);
    G.emit('plan');
  });
  $('p-cancel').addEventListener('click', function () { editing = false; render(); window.scrollTo(0, 0); });
  $('pr-edit').addEventListener('click', function () { editing = true; fillForm(saved); render(); window.scrollTo(0, 0); });

  var delArmed = false;
  $('pr-delete').addEventListener('click', function () {
    if (!delArmed) { delArmed = true; this.textContent = '한 번 더 누르면 지웁니다'; var b = this; setTimeout(function () { delArmed = false; b.textContent = '약속 지우기'; }, 4000); return; }
    delArmed = false; this.textContent = '약속 지우기';
    saved = null; G.store.set(KEY, null); G.store.set(DISMISS, null);
    $('alert').hidden = true; scheduleNotify();
    $('p-date').value = G.todayStr();
    render(); G.toast('약속을 지웠습니다.'); G.emit('plan');
  });

  $('pr-end-now').addEventListener('click', function () { showAlert(saved); window.scrollTo(0, 0); });
  $('al-close').addEventListener('click', function () {
    $('alert').hidden = true;
    if (saved) G.store.set(DISMISS, endDate(saved).toISOString());
  });

  $('pr-ics').addEventListener('click', function () {
    if (!saved) return;
    var blob = new Blob([buildIcs(saved)], { type: 'text/calendar;charset=utf-8' });
    G.saveFile('귀가약속.ics', blob).then(function () { if (!NATIVE) G.toast('캘린더 파일을 열어 일정에 추가하세요.'); }, function () { if (NATIVE) G.toast('캘린더 파일을 내보내지 못했습니다.'); });
  });

  $('pr-notify').addEventListener('click', function () {
    if (!canNotify) return;
    if (G.store.get(NOTIFY) && perm() === 'granted') {
      G.store.set(NOTIFY, null); scheduleNotify(); notifyLabel(); G.toast('앱 알림을 껐습니다.'); return;
    }
    (NATIVE ? NATIVE.notifyAsk() : Notification.requestPermission()).then(function (res) {
      if (NATIVE) nativePerm = res;
      if (res === 'granted') { G.store.set(NOTIFY, true); scheduleNotify(); G.toast('끝날 시간에 알림을 보냅니다.'); }
      else G.toast('알림이 허용되지 않았습니다. 캘린더에 추가해 주세요.');
      notifyLabel();
    }, function () { G.toast('알림을 켜지 못했습니다. 캘린더에 추가해 주세요.'); });
  });

  setInterval(checkAlert, 30000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) checkAlert(); });

  /* ---------- 다른 화면에서 쓰는 값 ---------- */
  G.plan = {
    get: function () { return saved; },
    current: function () { return saved || readForm(); },
    phrase: phrase,
    init: function () {
      if (saved) fillForm(saved); else { $('p-date').value = G.todayStr(); syncForm(); }
      render(); checkAlert(); scheduleNotify();
      if (NATIVE) NATIVE.notifyState().then(function (s) { nativePerm = s; notifyLabel(); scheduleNotify(); }, function () {});
    }
  };
})();
