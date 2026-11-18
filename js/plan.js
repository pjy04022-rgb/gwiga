/* 술자리 계획 · 종료 알림 · 캘린더 */
(function () {
  var G = window.Gwiga, $ = G.$;
  var KEY = 'gwiga-plan-v1', DISMISS = 'gwiga-dismiss-v1', JUMPED = 'gwiga-jumped-v1';
  var saved = G.store.get(KEY);
  var editing = false;

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

  /* ---------- 알림 (js/alarms.js) ----------
   * 앱: 휴대폰에 예약해 두어 앱을 꺼 두어도 정확한 시각에 화면 위로 뜬다.
   * 웹: 이 탭이 열려 있는 동안만 울린다. 그래서 캘린더 추가와 안드로이드 앱을 함께 안내한다.
   * 끝날 시간 15분 전·끝날 시간·(다음 날 운전 예정이면) 운전 30분 전, 세 번 알린다.
   */
  var A = G.alarms, NATIVE = G.native;
  var IS_ANDROID_WEB = !NATIVE && !G.inArtifact && /Android/i.test(navigator.userAgent);

  function notifyBody(p) {
    return '오늘은 ' + (p.method === '근처 숙소' ? '근처에서 자고 가기로 했습니다.' : phrase(p.method) + ' 귀가하기로 했습니다.') + ' 맑은 정신일 때 정한 약속입니다.';
  }
  function planAlarms(p) {
    var end = endDate(p);
    var list = [
      { title: '15분 뒤 술자리가 끝납니다', at: new Date(end.getTime() - 15 * 60000), hash: 'plan',
        body: notifyBody(p) + (p.car === 'y' && p.method !== '대리운전' ? ' 차 키는 친구에게 맡겨 두세요.' : p.method === '대리운전' ? ' 지금 대리운전을 불러 두세요.' : '') },
      { title: '술자리 끝날 시간입니다', body: notifyBody(p) + ' 지금 기분이 괜찮아도 운전대는 잡지 마세요.', at: end, hash: 'plan' }
    ];
    if (p.drv === 'y') list.push({ title: '운전 전 숙취 확인', hash: 'check', at: new Date(driveDate(p).getTime() - 30 * 60000),
      body: '어젯밤 술자리 뒤 ' + p.drive + '에 운전할 예정입니다. 알코올이 남아 있을 수 있으니 숙취 계산기로 확인하고, 조금이라도 의심되면 운전하지 마세요.' });
    return list;
  }
  /* 계획 알림은 15분 전·끝날 시간·운전 전, 최대 3개 */
  function scheduleNotify() { A.set('plan', saved ? planAlarms(saved) : []); }

  function hhmm(d) { return G.pad(d.getHours()) + ':' + G.pad(d.getMinutes()); }
  function alarmLabel() {
    var box = $('pr-alarm');
    box.hidden = !saved;
    if (!saved) return;
    var on = A.enabled(), st = A.state(), end = endDate(saved), past = end.getTime() <= Date.now();
    var title, sub, cls;
    if (!A.supported) {
      title = '이 브라우저는 알림을 보낼 수 없습니다';
      sub = (G.device && G.device.ios && !G.device.standalone ? '아이폰은 Safari 공유 → 홈 화면에 추가한 뒤 그 아이콘으로 열면 알림을 켤 수 있습니다. 지금은 ' : '')
        + '아래 캘린더에 추가하면 캘린더 앱이 끝날 시간에 알려 줍니다.'; cls = 'warn';
    } else if (st === 'denied') {
      title = '알림이 막혀 있습니다';
      sub = NATIVE ? '휴대폰 설정 → 애플리케이션 → 귀가약속 → 알림에서 허용해 주세요.' : '브라우저 주소창 옆 설정에서 이 사이트의 알림을 허용해 주세요. 그동안은 캘린더에 추가해 두세요.'; cls = 'warn';
    } else if (!on) {
      title = A.userOff() ? '알림을 꺼 두었습니다' : '알림이 아직 꺼져 있습니다';
      sub = '켜 두면 끝나기 15분 전과 끝날 시간 ' + hhmm(end) + '에 약속을 다시 알려 줍니다.'; cls = 'off';
    } else if (NATIVE && A.exact() !== 'granted') {
      title = '알림이 몇 분 늦게 울릴 수 있습니다';
      sub = '"정확한 시간 알림 허용"을 누르고 귀가약속을 켜 주세요.'; cls = 'warn';
    } else if (past) {
      title = '끝날 시간이 지났습니다'; sub = '다음 술자리 전에 약속을 새로 저장하면 다시 알려 줍니다.'; cls = 'on';
    } else if (NATIVE) {
      title = hhmm(end) + '에 알림이 울립니다';
      sub = '앱을 꺼 두어도 끝나기 15분 전과 끝날 시간에 화면 위로 알려 줍니다.' + (saved.drv === 'y' ? ' 내일 운전 30분 전에도 알립니다.' : ''); cls = 'on';
    } else {
      title = hhmm(end) + '에 알림이 울립니다 (이 탭이 열려 있을 때만)';
      sub = '탭을 닫아도 받으려면 캘린더에 추가' + (IS_ANDROID_WEB ? '하거나 안드로이드 앱을 받으세요.' : '하세요.'); cls = 'warn';
    }
    box.className = 'alarm-status ' + cls;
    $('pr-alarm-title').textContent = title;
    $('pr-alarm-sub').textContent = sub;
    $('pr-alarm-on').hidden = !A.supported || on || st === 'denied';
    $('pr-alarm-exact').hidden = !(NATIVE && on && A.exact() !== 'granted');
    $('pr-alarm-off').hidden = !on;
  }

  /* 약속을 저장하는 순간(사용자가 누른 순간) 알림 권한을 묻는다. 직접 끈 사람에게는 다시 묻지 않는다. */
  function autoAsk() {
    if (!A.supported || A.userOff() || A.state() === 'denied') return Promise.resolve();
    if (A.state() === 'granted') return A.turnOn();
    return A.ask().then(function (res) {
      if (res === 'granted') G.toast('끝날 시간에 알림을 보냅니다.');
    });
  }

  /* ---------- 종료 알림 화면 ---------- */
  function showAlert(p) {
    $('al-title').textContent = p.method === '근처 숙소' ? '오늘은 근처에서 자고 가기로 했습니다' : '오늘은 ' + phrase(p.method) + ' 귀가하기로 했습니다';
    $('al-text').textContent = (p.car === 'y' ? '차는 두고 가세요. ' : '') + '맑은 정신일 때 정한 약속입니다. 지금 기분이 괜찮아도 판단력은 이미 흐려져 있을 수 있습니다.';
    $('al-memo').hidden = !p.memo; $('al-memo').textContent = p.memo || '';
    $('al-check').hidden = p.drv !== 'y';
    $('alert').hidden = false;
  }
  function alertDue() {
    if (!saved) return false;
    var e = endDate(saved), now = Date.now();
    return now >= e.getTime() && now < e.getTime() + 6 * 3600000 && G.store.get(DISMISS) !== e.toISOString();
  }
  function checkAlert() {
    if (alertDue()) showAlert(saved); else if (!saved) $('alert').hidden = true;
  }
  /* 끝날 시간이 지난 뒤 앱을 다시 열면, 다른 화면을 보고 있었더라도 한 번은 약속 화면으로 데려온다 */
  function jumpIfDue() {
    if (!alertDue()) return false;
    var key = endDate(saved).toISOString();
    if (G.store.get(JUMPED) === key) return false;
    G.store.set(JUMPED, key);
    if (location.hash !== '#plan' && location.hash !== '') location.hash = 'plan';
    showAlert(saved); window.scrollTo(0, 0);
    return true;
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
    $('pr-apk').hidden = !IS_ANDROID_WEB;
    alarmLabel();
  }

  /* ---------- 이벤트 ---------- */
  $('plan-form').addEventListener('change', syncForm);
  $('plan-form').addEventListener('input', syncForm);
  $('plan-form').addEventListener('submit', function (e) {
    e.preventDefault();
    saved = readForm();
    G.store.set(KEY, saved); G.store.set(DISMISS, null); G.store.set(JUMPED, null);
    editing = false; render(); checkAlert(); scheduleNotify();
    G.toast('약속을 저장했습니다.');
    autoAsk();
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

  $('pr-alarm-on').addEventListener('click', function () {
    A.turnOn().then(function (res) {
      if (res === 'granted') G.toast('끝날 시간에 알림을 보냅니다.');
      else G.toast('알림이 허용되지 않았습니다. 캘린더에 추가해 주세요.');
    });
  });
  $('pr-alarm-off').addEventListener('click', function () { A.turnOff(); G.toast('알림을 껐습니다.'); });
  $('pr-alarm-exact').addEventListener('click', function () { A.openExactSettings(); });

  /* 알림을 켜고 끄거나 권한이 바뀌면 모든 예약을 다시 건다 */
  A.onChange(function () { scheduleNotify(); alarmLabel(); });

  setInterval(function () { checkAlert(); alarmLabel(); }, 30000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { if (!jumpIfDue()) checkAlert(); } });

  /* ---------- 다른 화면에서 쓰는 값 ---------- */
  G.plan = {
    get: function () { return saved; },
    current: function () { return saved || readForm(); },
    phrase: phrase,
    due: alertDue,
    init: function () {
      if (saved) fillForm(saved); else { $('p-date').value = G.todayStr(); syncForm(); }
      render(); scheduleNotify();
      if (!jumpIfDue()) checkAlert();
    }
  };
})();
