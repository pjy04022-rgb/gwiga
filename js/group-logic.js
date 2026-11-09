/* 모임 모드 규칙 — 화면·저장소와 분리된 순수 함수. node tools/check.mjs 로 점검한다.
 *
 * 강제성의 핵심 규칙
 *  1. 별명·귀가 방법·차 여부를 모두 골라야 참가할 수 있다 (기본값 없음).
 *  2. 차를 가져온 사람은 친구가 '키 받았어요'를 누르거나, 대리운전으로 정하고 끝날 때
 *     '대리 기사 만났어요'를 눌러야 확인된다. 그전까지는 '미확인'.
 *  3. 미확인인 사람은 '귀가 완료'를 누를 수 없다.
 *  4. 총무는 술자리가 끝나고 미확인이 0명이어야 모임을 마무리할 수 있다.
 */
(function (root) {
  var METHODS = ['택시', '대리운전', '심야버스·지하철', '걸어서', '가족 차', '근처 숙소'];
  var METHOD_LABEL = { '가족 차': '가족이 데리러 옴', '근처 숙소': '근처에서 자고 감' };

  var STATUS = {
    ok:        { label: '차 없음',      tone: 'neutral' },
    key:       { label: '키 맡김 확인', tone: 'good' },
    daeri:     { label: '대리 기사 만남', tone: 'good' },
    'key-wait':{ label: '키 확인 대기', tone: 'warn' },
    pending:   { label: '미확인',       tone: 'danger' },
    home:      { label: '귀가 완료',    tone: 'good' }
  };

  function endAt(room) {
    var s = new Date(room.date + 'T' + room.start), e = new Date(room.date + 'T' + room.end);
    if (e <= s) e.setDate(e.getDate() + 1);
    return e.getTime();
  }

  function status(m) {
    if (m.home) return 'home';
    if (m.car !== 'y') return 'ok';
    if (m.keyConfirmed) return 'key';
    if (m.method === '대리운전' && m.daeriMet) return 'daeri';
    if (m.keyTo) return 'key-wait';
    return 'pending';
  }
  function isUnresolved(st) { return st === 'pending' || st === 'key-wait'; }

  function summary(members) {
    var s = { total: members.length, cars: 0, unresolved: 0, home: 0, unresolvedNicks: [] };
    members.forEach(function (m) {
      var st = status(m);
      if (m.car === 'y') s.cars++;
      if (isUnresolved(st)) { s.unresolved++; s.unresolvedNicks.push(m.nick); }
      if (st === 'home') s.home++;
    });
    return s;
  }

  /* 귀가 완료를 누를 수 있는가: 미확인이면 안 됨, 끝나기 전이면 안 됨 */
  function canGoHome(m, ended) { return ended && !m.home && !isUnresolved(status(m)); }

  /* 총무 마무리 조건 */
  function closeBlock(members, ended) {
    if (!members.length) return '아직 참가한 사람이 없습니다.';
    if (!ended) return '술자리가 끝난 뒤에 마무리할 수 있습니다.';
    var n = summary(members).unresolved;
    if (n > 0) return '확인되지 않은 차가 ' + n + '대 남아 있어 마무리할 수 없습니다.';
    return '';
  }

  function cleanNick(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

  function validateJoin(d, members) {
    var errs = [], nick = cleanNick(d.nick);
    if (!nick) errs.push('별명을 적어 주세요.');
    else if (nick.length > 12) errs.push('별명은 12자 이하로 적어 주세요.');
    else if ((members || []).some(function (m) { return m.nick === nick; })) errs.push('같은 별명이 이미 있습니다. 다른 별명을 적어 주세요.');
    if (METHODS.indexOf(d.method) < 0) errs.push('귀가 방법을 골라 주세요.');
    if (d.car !== 'y' && d.car !== 'n') errs.push('차를 가져오는지 골라 주세요.');
    return errs;
  }

  var CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function makeCode(rand) {
    rand = rand || Math.random;
    var c = '';
    for (var i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
    return c;
  }

  var api = {
    METHODS: METHODS, METHOD_LABEL: METHOD_LABEL, STATUS: STATUS,
    endAt: endAt, status: status, isUnresolved: isUnresolved, summary: summary,
    canGoHome: canGoHome, closeBlock: closeBlock, validateJoin: validateJoin,
    cleanNick: cleanNick, makeCode: makeCode
  };
  root.GwigaGroup = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
