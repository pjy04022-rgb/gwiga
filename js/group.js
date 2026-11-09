/* 모임 모드 화면 — 규칙은 group-logic.js, 저장은 group-store.js */
(function () {
  var G = window.Gwiga, $ = G.$, L = window.GwigaGroup, S = G.groupStore;
  var LOCAL = S.mode === 'local';

  var active = false;
  var cur = null;          // 보고 있는 모임 코드 (null이면 목록)
  var joinMode = false;    // 참가 화면을 보는 중
  var viewAs = {};         // 시연판: 코드 → 'host' | 참가자 id
  var renderSeq = 0;
  var pending = false;     // 입력 중이라 미뤄 둔 새로 그리기
  var busy = false;        // 서버 요청 중

  /* ---------- 도우미 ---------- */
  function h(tag, props, kids) {
    var e = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;            // 고정 문구에만 쓴다 (사용자 입력 금지)
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  function methodLabel(m) { return L.METHOD_LABEL[m] || m; }
  function timeRange(r) { return G.korDate(r.date) + ' ' + r.start + '–' + r.end; }
  function now(r) { return Date.now() + ((r && r.skew) || 0); }
  function isEnded(r) { return !!r.simEnded || now(r) >= L.endAt(r); }
  function pill(st) { var s = L.STATUS[st]; return h('span', { class: 'gpill t-' + s.tone, text: s.label }); }
  function go(hash) { if (location.hash === '#' + hash) render(); else location.hash = hash; }
  function errMsg(e) { return (e && e.errors && e.errors.join(' ')) || '저장하지 못했습니다. 다시 시도해 주세요.'; }

  /* 서버 요청: 버튼을 잠시 막고, 실패하면 이유를 알려 준다 */
  function run(btn, promise, okMsg) {
    if (busy) return;
    busy = true;
    if (btn) btn.disabled = true;
    promise.then(function () { busy = false; if (okMsg) G.toast(okMsg); render(); },
      function (e) { busy = false; if (btn) btn.disabled = false; G.toast(errMsg(e)); render(); });
  }

  function viewer(r) {
    if (LOCAL) {
      var v = viewAs[r.code];
      if (v && (v === 'host' ? r.host : r.members.some(function (m) { return m.id === v; }))) return { me: v === 'host' ? null : v, host: v === 'host' };
      if (r.me) return { me: r.me, host: false };
      return { me: null, host: r.host };
    }
    return { me: r.me, host: r.host };
  }

  /* ---------- 그리기 ---------- */
  function typing() {
    var a = document.activeElement, root = $('group-root');
    return a && root.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName);
  }
  function render() {
    if (!active) return;
    if (typing() && $('group-root').firstChild) { pending = true; return; }
    pending = false;
    var seq = ++renderSeq, root = $('group-root');
    if (!root.firstChild) root.replaceChildren(loadingView());
    if (!cur) {
      S.watch(null);
      S.listRooms().then(function (rooms) { if (seq === renderSeq) root.replaceChildren(listView(rooms)); },
        function (e) { if (seq === renderSeq) root.replaceChildren(listView([], errMsg(e))); });
      return;
    }
    S.watch(cur);
    S.getRoom(cur).then(function (r) {
      if (seq !== renderSeq) return;
      if (!r) { root.replaceChildren(missingView()); return; }
      if (joinMode || (!r.host && !r.me)) { if (!$('j-nick') || $('j-nick').dataset.code !== r.code) root.replaceChildren(joinView(r)); }
      else root.replaceChildren(boardView(r));
    }, function (e) { if (seq === renderSeq) root.replaceChildren(errorView(errMsg(e))); });
  }
  $('group-root').addEventListener('focusout', function () { setTimeout(function () { if (pending && !typing()) render(); }, 0); });

  function loadingView() { return h('p', { class: 'hint', text: '모임 정보를 불러오는 중입니다.' }); }
  function errorView(msg) {
    return h('div', { class: 'stack' }, [
      h('p', { class: 'caution', text: msg }),
      h('div', { class: 'btns' }, [h('button', { class: 'btn', type: 'button', text: '다시 불러오기', onclick: render }), h('a', { class: 'btn ghost', href: '#group', text: '모임 목록' })])
    ]);
  }

  /* ---------- 1. 모임 목록·만들기·코드로 참가 ---------- */
  function listView(rooms, loadErr) {
    var title = h('input', { type: 'text', id: 'g-title', maxlength: '30', placeholder: '예: 경찰학과 개강총회' });
    var date = h('input', { type: 'date', id: 'g-date', value: G.todayStr() });
    var start = h('input', { type: 'time', id: 'g-start', value: '19:00' });
    var end = h('input', { type: 'time', id: 'g-end', value: '23:00' });
    var err = h('p', { class: 'form-err', role: 'alert' });
    var createBtn = h('button', { class: 'btn', type: 'submit', text: '모임 만들기' });

    var form = h('form', { class: 'panel', autocomplete: 'off', onsubmit: function (e) {
      e.preventDefault();
      if (!L.cleanNick(title.value)) { err.textContent = '모임 이름을 적어 주세요.'; title.focus(); return; }
      var d = { title: title.value, date: date.value || G.todayStr(), start: start.value || '19:00', end: end.value || '23:00' };
      if (L.endAt(d) < Date.now() - 12 * 3600000) { err.textContent = '이미 지난 날짜입니다. 날짜와 시간을 다시 확인해 주세요.'; return; }
      createBtn.disabled = true;
      S.createRoom(d).then(function (r) {
        if (LOCAL) viewAs[r.code] = 'host';
        title.blur();
        G.toast('모임을 만들었습니다. 참가 링크를 단체방에 보내세요.');
        go('room-' + r.code);
      }, function (e2) { createBtn.disabled = false; err.textContent = errMsg(e2); });
    } }, [
      h('h2', { class: 'sub', text: '총무라면 모임을 만드세요' }),
      h('label', { for: 'g-title' }, ['모임 이름', title]),
      h('div', { class: 'row3' }, [h('label', { for: 'g-date' }, ['날짜', date]), h('label', { for: 'g-start' }, ['시작', start]), h('label', { for: 'g-end' }, ['끝날 예정', end])]),
      err,
      h('div', { class: 'btns' }, [createBtn])
    ]);

    var codeIn = h('input', { type: 'text', id: 'g-code', maxlength: '6', placeholder: '예: CY8H88', autocapitalize: 'characters', inputmode: 'text', class: 'mono' });
    var codeErr = h('p', { class: 'form-err', role: 'alert' });
    var joinBox = h('form', { class: 'panel', autocomplete: 'off', onsubmit: function (e) {
      e.preventDefault();
      var c = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!/^[A-HJ-NP-Z2-9]{6}$/.test(c)) { codeErr.textContent = '모임 코드 6자리를 확인해 주세요.'; return; }
      codeIn.blur(); go('join-' + c);
    } }, [
      h('h2', { class: 'sub', text: '참가 링크를 받았다면' }),
      h('p', { class: 'muted', text: '단체방의 참가 링크를 누르면 바로 참가 화면이 열립니다. 링크 대신 코드를 받았다면 여기에 입력하세요.' }),
      h('label', { for: 'g-code' }, ['모임 코드', codeIn]), codeErr,
      h('div', { class: 'btns' }, [h('button', { class: 'btn ghost', type: 'submit', text: '코드로 참가' })])
    ]);

    var side = LOCAL ? h('div', { class: 'stack' }, [joinBox, h('div', { class: 'panel demo-card' }, [
      h('h2', { class: 'sub', text: '먼저 둘러보기' }),
      h('p', { text: '참가자 다섯 명이 있는 예시 모임을 만들어, 총무 화면과 참가자 화면을 번갈아 볼 수 있습니다.' }),
      h('div', { class: 'btns' }, [h('button', { class: 'btn ghost', type: 'button', text: '예시 모임 열기', onclick: seedExample })])
    ])]) : joinBox;

    var list = rooms.length ? h('div', { class: 'block' }, [
      h('h2', { class: 'sub', text: '내 모임' }),
      h('ul', { class: 'room-list' }, rooms.map(function (r) {
        var s = L.summary(r.members), role = r.host && r.me ? '총무·참가' : r.host ? '총무' : '참가';
        return h('li', null, [h('a', { href: '#room-' + r.code }, [
          h('span', { class: 'rl-main' }, [h('b', { text: r.title }), r.example ? h('span', { class: 'tag', text: '예시' }) : null, r.closed ? h('span', { class: 'tag done', text: '마무리됨' }) : null]),
          h('span', { class: 'rl-sub', text: timeRange(r) + ' · ' + role + ' · 참가 ' + s.total + '명' + (s.unresolved ? ' · 미확인 ' + s.unresolved + '명' : '') })
        ])]);
      }))
    ]) : null;

    return h('div', { class: 'stack' }, [
      h('div', { class: 'head' }, [
        h('span', { class: 'eyebrow', text: '모임 · 함께 마시는 사람끼리' }),
        h('h1', { html: '귀가 방법을 정해야<br><em>모임에 들어올 수 있습니다</em>' }),
        h('p', { class: 'lead', text: '혼자 하는 약속은 잊기 쉽습니다. 총무가 모임을 만들면 참가자 모두가 귀가 방법을 정해야 하고, 차를 가져온 사람은 친구가 확인할 때까지 총무 화면에 미확인으로 남습니다.' })
      ]),
      loadErr ? h('p', { class: 'caution', text: loadErr }) : null,
      list,
      h('div', { class: 'grid-2' }, [form, side]),
      flowSteps(),
      LOCAL ? h('p', { class: 'caution', text: '서버가 연결되지 않아 이 기기 안에서만 동작하는 시연판으로 열렸습니다.' })
            : h('p', { class: 'hint', text: '모임에는 별명, 귀가 방법, 차 여부만 저장되고, 모임이 끝난 다음 날 자동으로 지워집니다.' })
    ]);
  }

  function flowSteps() {
    var items = [
      ['총무가 모임을 만듭니다', '날짜와 끝날 시간을 정하고 참가 링크를 단체방에 올립니다.'],
      ['귀가 방법을 골라야 참가', '별명, 귀가 방법, 차를 가져오는지 모두 골라야 참가할 수 있습니다.'],
      ['차는 친구가 확인', '키를 맡긴 친구가 "받았어요"를 누르기 전까지 미확인으로 남습니다.'],
      ['미확인 0명이어야 마무리', '술자리가 끝나고 모든 차가 확인돼야 총무가 모임을 마무리합니다.']
    ];
    return h('div', { class: 'block' }, [
      h('h2', { class: 'sub', text: '이렇게 진행됩니다' }),
      h('ol', { class: 'gflow' }, items.map(function (it, i) {
        return h('li', null, [h('i', { text: String(i + 1) }), h('b', { text: it[0] }), h('span', { text: it[1] })]);
      }))
    ]);
  }

  function seedExample() {
    S.createRoom({ title: '경찰학과 개강총회', date: G.todayStr(), start: '19:00', end: '23:00', example: true }).then(function (r) {
      var people = [
        { nick: '민수', method: '택시', car: 'n' }, { nick: '지현', method: '대리운전', car: 'y' },
        { nick: '태호', method: '택시', car: 'y' }, { nick: '서연', method: '심야버스·지하철', car: 'n' },
        { nick: '준', method: '걸어서', car: 'y' }
      ];
      var ids = {};
      return people.reduce(function (p, d) {
        return p.then(function () { return S.join(r.code, Object.assign({ example: true }, d)).then(function (m) { ids[d.nick] = m.id; }); });
      }, Promise.resolve()).then(function () { return S.giveKey(r.code, ids['태호'], ids['민수']); })
        .then(function () { viewAs[r.code] = 'host'; G.toast('예시 모임을 열었습니다. 위쪽에서 누구 화면으로 볼지 바꿔 보세요.'); go('room-' + r.code); });
    });
  }

  function missingView() {
    return h('div', { class: 'stack' }, [
      h('div', { class: 'head' }, [
        h('span', { class: 'eyebrow', text: '모임' }),
        h('h1', { text: '모임을 찾을 수 없습니다' }),
        h('p', { class: 'lead', text: LOCAL
          ? '끝난 지 하루가 지나 자동으로 지워졌거나, 다른 기기에서 만든 모임입니다. 시연판에서는 모임을 만든 기기에서만 열 수 있습니다.'
          : '코드가 틀렸거나, 총무가 모임을 지웠거나, 끝난 지 하루가 지나 자동으로 지워졌습니다.' })
      ]),
      h('div', { class: 'btns' }, [h('a', { class: 'btn', href: '#group', text: '모임 목록으로' })])
    ]);
  }

  /* ---------- 2. 참가 (세 항목을 모두 골라야 참가) ---------- */
  function joinView(r) {
    var nick = h('input', { type: 'text', id: 'j-nick', maxlength: '12', placeholder: '예: 경찰학과 24학번', autocomplete: 'off', 'data-code': r.code });
    var chips = h('div', { class: 'chips', role: 'radiogroup', 'aria-label': '귀가 방법' });
    L.METHODS.forEach(function (m, i) {
      chips.appendChild(h('input', { type: 'radio', name: 'j-method', id: 'jm-' + i, value: m }));
      chips.appendChild(h('label', { for: 'jm-' + i, text: methodLabel(m) }));
    });
    var seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-labelledby': 'j-car-l' }, [
      h('input', { type: 'radio', name: 'j-car', id: 'jc-n', value: 'n' }), h('label', { for: 'jc-n', text: '안 가져온다' }),
      h('input', { type: 'radio', name: 'j-car', id: 'jc-y', value: 'y' }), h('label', { for: 'jc-y', text: '가져온다' })
    ]);
    var carNote = h('p', { class: 'caution', hidden: true });
    var need = h('p', { class: 'hint need' });
    var err = h('p', { class: 'form-err', role: 'alert' });
    var submit = h('button', { class: 'btn', type: 'submit', text: '참가하기', disabled: true });

    function val() {
      var m = document.querySelector('input[name=j-method]:checked'), c = document.querySelector('input[name=j-car]:checked');
      return { nick: nick.value, method: m ? m.value : '', car: c ? c.value : '' };
    }
    function sync() {
      var d = val(), miss = [];
      if (!L.cleanNick(d.nick)) miss.push('별명');
      if (!d.method) miss.push('귀가 방법');
      if (!d.car) miss.push('차');
      submit.disabled = miss.length > 0;
      need.textContent = miss.length ? '아직 고르지 않은 항목: ' + miss.join(', ') : '모두 골랐습니다.';
      carNote.hidden = d.car !== 'y';
      carNote.textContent = d.method === '대리운전'
        ? '술자리가 끝나고 대리 기사를 만나면 "대리 기사 만났어요"를 눌러야 확인됩니다. 그전까지 총무 화면에 미확인으로 보입니다.'
        : '술자리 중 함께 있는 친구에게 차 키를 맡기고, 그 친구가 "받았어요"를 눌러야 확인됩니다. 그전까지 총무 화면에 미확인으로 보입니다.';
      err.textContent = '';
    }

    var form = h('form', { class: 'panel', autocomplete: 'off', novalidate: true, oninput: sync, onchange: sync, onsubmit: function (e) {
      e.preventDefault();
      var d = val(), errs = L.validateJoin(d, r.members);
      if (errs.length) { err.textContent = errs.join(' '); return; }
      submit.disabled = true;
      S.join(r.code, d).then(function (m) {
        joinMode = false;
        if (LOCAL) viewAs[r.code] = m.id;
        if (document.activeElement) document.activeElement.blur();
        G.toast(m.nick + '님, 참가했습니다.');
        go('room-' + r.code);
      }, function (e2) { submit.disabled = false; err.textContent = errMsg(e2); });
    } }, [
      h('fieldset', null, [h('legend', { html: '<i>1</i>별명' }), h('label', { for: 'j-nick' }, ['실명 대신 모임에서 알아볼 수 있는 별명', nick])]),
      h('fieldset', null, [h('legend', { html: '<i>2</i>어떻게 돌아가나요' }), chips]),
      h('fieldset', null, [h('legend', { html: '<i>3</i>차를 가져오나요', id: 'j-car-l' }), seg, carNote]),
      need, err,
      h('div', { class: 'btns' }, [submit, (r.host || r.me) ? h('button', { class: 'btn ghost', type: 'button', text: '취소', onclick: function () { joinMode = false; go('room-' + r.code); } }) : null]),
      h('p', { class: 'hint', text: '별명, 귀가 방법, 차 여부만 저장하며 모임이 끝난 다음 날 자동으로 지워집니다.' })
    ]);
    setTimeout(sync, 0);

    return h('div', { class: 'stack' }, [
      h('div', { class: 'head' }, [
        h('span', { class: 'eyebrow', text: '모임 참가 · 코드 ' + r.code }),
        h('h1', { text: r.title }),
        h('p', { class: 'lead', text: timeRange(r) + ' · 세 가지를 모두 골라야 참가할 수 있습니다.' })
      ]),
      r.closed ? h('p', { class: 'caution', text: '이미 마무리된 모임이라 참가할 수 없습니다.' }) : form
    ]);
  }

  /* ---------- 3. 모임 현황판 ---------- */
  function boardView(r) {
    var ms = r.members, ended = isEnded(r), sum = L.summary(ms), who = viewer(r);
    var me = ms.filter(function (m) { return m.id === who.me; })[0] || null;
    var byId = {}; ms.forEach(function (m) { byId[m.id] = m; });
    var parts = [];

    parts.push(h('div', { class: 'head' }, [
      h('span', { class: 'eyebrow' }, ['모임 · 코드 ' + r.code, r.example ? h('span', { class: 'tag', text: '예시 데이터' }) : null]),
      h('h1', { text: r.title }),
      h('p', { class: 'lead', text: timeRange(r) + (r.closed ? ' · 마무리됨' : ended ? ' · 끝날 시간이 지났습니다' : '') })
    ]));

    if (LOCAL) parts.push(demoBar(r, who, ended));
    if (ended) parts.push(endBanner(r, sum));

    parts.push(h('dl', { class: 'gstats' }, [
      stat('참가', sum.total + '명'), stat('차 가져옴', sum.cars + '대'),
      stat('미확인', sum.unresolved + '명', sum.unresolved ? 'bad' : ''), stat('귀가 완료', sum.home + '명')
    ]));

    /* 나에게 온 키 확인 요청 */
    if (me && !r.closed) ms.filter(function (o) { return o.keyTo === me.id && !o.keyConfirmed && !o.home; }).forEach(function (o) {
      var yes = h('button', { class: 'btn', type: 'button', text: '받았어요' });
      var no = h('button', { class: 'btn ghost', type: 'button', text: '아직 안 받았어요' });
      yes.addEventListener('click', function () { run(yes, S.confirmKey(r.code, me.id, o.id, true), o.nick + '님 차 키를 확인했습니다.'); });
      no.addEventListener('click', function () { run(no, S.confirmKey(r.code, me.id, o.id, false), o.nick + '님에게 다시 맡기라고 알려 주세요.'); });
      parts.push(h('div', { class: 'request', role: 'alert' }, [
        h('p', null, [h('b', { text: o.nick + '님' }), '이 차 키를 맡겼다고 합니다. 키를 직접 받았나요?']),
        h('div', { class: 'btns' }, [yes, no])
      ]));
    });

    if (me) parts.push(myCard(r, me, ms, byId, ended));
    if (who.host) parts.push(hostCard(r, ms, ended, !!me));
    if (!me && !who.host) parts.push(h('div', { class: 'btns' }, [h('a', { class: 'btn', href: '#join-' + r.code, text: '이 모임에 참가하기' })]));

    parts.push(memberList(ms, byId, who.me));

    if (ended && sum.cars) parts.push(h('a', { class: 'action', href: '#check' }, [
      h('b', { text: '내일 차를 찾기 전에 숙취 확인' }),
      h('span', { text: '차를 가져온 사람은 다음 날 아침에도 알코올이 남아 있을 수 있습니다.' })
    ]));

    parts.push(h('div', { class: 'btns' }, [h('a', { class: 'btn ghost', href: '#group', text: '모임 목록' })]));
    parts.push(h('p', { class: 'hint', text: '별명, 귀가 방법, 차 여부만 저장하며 모임이 끝난 다음 날 자동으로 지워집니다.' + (LOCAL ? '' : ' 화면은 몇 초마다 자동으로 새로 고쳐집니다.') }));

    return h('div', { class: 'stack' }, parts);
  }

  function stat(k, v, cls) { return h('div', { class: cls || null }, [h('dt', { text: k }), h('dd', { text: v })]); }

  function demoBar(r, who, ended) {
    var cur = who.host ? 'host' : who.me;
    var sel = h('select', { id: 'g-viewas', 'aria-label': '누구 화면으로 볼지', onchange: function () { viewAs[r.code] = sel.value; sel.blur(); render(); } });
    if (r.host) sel.appendChild(h('option', { value: 'host', text: '총무 화면', selected: cur === 'host' }));
    r.members.forEach(function (m) { sel.appendChild(h('option', { value: m.id, text: m.nick + ' 화면', selected: cur === m.id })); });
    var realEnded = Date.now() >= L.endAt(r);
    return h('div', { class: 'demo-bar' }, [
      h('span', { class: 'demo-l', text: '시연' }),
      h('label', { for: 'g-viewas', class: 'demo-sel' }, ['누구 화면으로 볼까요', sel]),
      h('div', { class: 'btns' }, [
        r.closed ? null : h('button', { class: 'btn ghost small', type: 'button', text: '새 참가자로 참가해 보기', onclick: function () { joinMode = true; go('join-' + r.code); } }),
        realEnded ? null : h('button', { class: 'btn ghost small', type: 'button', text: ended ? '끝나기 전으로 되돌리기' : '끝날 시간으로 건너뛰기', onclick: function () { S.setSimEnded(r.code, !ended); } })
      ])
    ]);
  }

  function endBanner(r, sum) {
    if (r.closed) return h('div', { class: 'gbanner done' }, [h('b', { text: '총무가 모임을 마무리했습니다' }), h('span', { text: '차를 가져온 사람 모두 확인됐습니다.' })]);
    if (sum.unresolved) return h('div', { class: 'gbanner warn', role: 'alert' }, [
      h('b', { text: '술자리가 끝났습니다. 확인되지 않은 차가 ' + sum.unresolved + '대 있습니다' }),
      h('span', { text: sum.unresolvedNicks.join(', ') + ' · 운전대를 잡지 않도록 지금 확인해 주세요.' })
    ]);
    return h('div', { class: 'gbanner ok' }, [h('b', { text: '술자리가 끝났습니다' }), h('span', { text: sum.cars ? '차를 가져온 사람 모두 확인됐습니다. 약속대로 귀가하세요.' : '약속대로 귀가하세요.' })]);
  }

  function myCard(r, me, ms, byId, ended) {
    var st = L.status(me), body = [];
    body.push(h('div', { class: 'my-top' }, [h('span', { class: 'cap', text: '내 상태 · ' + me.nick }), pill(st)]));
    var how = me.method === '근처 숙소' ? '근처에서 자고 갑니다' : (me.method === '걸어서' ? '걸어서 귀가합니다' : methodLabel(me.method) + G.ro(methodLabel(me.method)) + ' 귀가합니다');
    body.push(h('p', { class: 'my-big', text: how }));

    if (r.closed) {
      body.push(h('p', { class: 'my-note', text: st === 'home' ? '귀가 완료를 알렸습니다. 수고하셨습니다.' : '모임이 마무리됐습니다. 약속대로 귀가하세요.' }));
    } else if (L.isUnresolved(st)) {
      if (st === 'key-wait') {
        var cancel = h('button', { class: 'btn ghost on-dark small', type: 'button', text: '다른 친구에게 맡기기' });
        cancel.addEventListener('click', function () { run(cancel, S.cancelKey(r.code, me.id)); });
        body.push(h('p', { class: 'my-note', text: (byId[me.keyTo] ? byId[me.keyTo].nick : '친구') + '님이 "받았어요"를 누르면 확인됩니다.' }));
        body.push(h('div', { class: 'btns' }, [cancel]));
      } else {
        var others = ms.filter(function (m) { return m.id !== me.id; });
        body.push(h('p', { class: 'my-note', text: '차를 가져와 미확인 상태입니다. 함께 있는 친구에게 키를 맡기고 확인을 받으세요.' }));
        if (others.length) {
          var sel = h('select', { id: 'g-keyto', 'aria-label': '키를 맡길 친구' }, others.map(function (o) { return h('option', { value: o.id, text: o.nick }); }));
          var give = h('button', { class: 'btn amber', type: 'button', text: '이 친구에게 키 맡기기' });
          give.addEventListener('click', function () { sel.blur(); run(give, S.giveKey(r.code, me.id, sel.value), '친구가 "받았어요"를 누르면 확인됩니다.'); });
          body.push(h('div', { class: 'keyrow' }, [sel, give]));
        } else body.push(h('p', { class: 'my-note', text: '함께 있는 친구가 참가하면 키를 맡길 수 있습니다.' }));
      }
      if (me.method === '대리운전') {
        var met = h('button', { class: 'btn ghost on-dark', type: 'button', text: '대리 기사 만났어요', disabled: !ended });
        met.addEventListener('click', function () { run(met, S.daeriMet(r.code, me.id), '대리운전으로 확인됐습니다.'); });
        body.push(h('div', { class: 'btns' }, [met]));
        if (!ended) body.push(h('p', { class: 'my-note dim', text: '"대리 기사 만났어요"는 술자리가 끝난 뒤 누를 수 있습니다.' }));
      }
      body.push(h('p', { class: 'my-note dim', text: '미확인 상태에서는 "집에 도착했어요"를 누를 수 없습니다.' }));
    } else if (st === 'home') {
      body.push(h('p', { class: 'my-note', text: '귀가 완료를 알렸습니다. 수고하셨습니다.' }));
    } else if (L.canGoHome(me, ended)) {
      var home = h('button', { class: 'btn amber block', type: 'button', text: '집에 도착했어요' });
      home.addEventListener('click', function () { run(home, S.goHome(r.code, me.id), '귀가 완료를 알렸습니다.'); });
      body.push(home);
    } else {
      body.push(h('p', { class: 'my-note', text: '술자리가 끝나면 이 자리에 "집에 도착했어요" 버튼이 나타납니다.' }));
    }
    return h('div', { class: 'promise mycard' }, body);
  }

  function hostCard(r, ms, ended, joined) {
    var link = location.href.split('#')[0] + '#join-' + r.code;
    var block = r.closed ? '' : L.closeBlock(ms, ended);
    var shareText = '[귀가약속] ' + r.title + ' (' + timeRange(r) + ')\n귀가 방법을 정하고 참가해 주세요. 코드 ' + r.code;
    var canShare = !G.inArtifact && !!navigator.share;

    var delArmed = false;
    var delBtn = h('button', { class: 'btn ghost danger small', type: 'button', text: '모임 지우기' });
    delBtn.addEventListener('click', function () {
      if (!delArmed) { delArmed = true; delBtn.textContent = '한 번 더 누르면 지웁니다'; return; }
      S.remove(r.code).then(function () { G.toast('모임을 지웠습니다.'); go('group'); }, function (e) { G.toast(errMsg(e)); });
    });
    var closeBtn = h('button', { class: 'btn', type: 'button', text: '모임 마무리', disabled: !!block });
    closeBtn.addEventListener('click', function () { run(closeBtn, S.close(r.code), '모임을 마무리했습니다.'); });

    return h('div', { class: 'panel hostcard' }, [
      h('h2', { class: 'sub', text: '총무 · 참가 링크 보내기' }),
      h('p', { class: 'muted', text: '이 링크를 단체방에 올리세요. 받은 사람은 귀가 방법을 골라야 참가할 수 있습니다.' }),
      h('div', { class: 'linkrow' }, [
        h('input', { type: 'text', id: 'g-link', readonly: true, value: link, 'aria-label': '참가 링크' }),
        h('button', { class: 'btn small', type: 'button', text: '복사', onclick: function () { G.copyText(shareText + '\n' + link, $('g-link')); } })
      ]),
      canShare ? h('div', { class: 'btns' }, [h('button', { class: 'btn amber', type: 'button', text: '카카오톡 등으로 보내기', onclick: function () {
        navigator.share({ title: '귀가약속 · ' + r.title, text: shareText, url: link }).catch(function () {});
      } })]) : null,
      LOCAL ? h('p', { class: 'hint', text: '시연판에서는 이 링크가 모임을 만든 기기에서만 열립니다.' }) : null,
      (!joined && !LOCAL && !r.closed) ? h('div', { class: 'btns' }, [h('button', { class: 'btn ghost', type: 'button', text: '나도 참가자로 등록하기', onclick: function () { joinMode = true; go('join-' + r.code); } })]) : null,
      h('h2', { class: 'sub', text: '모임 마무리' }),
      r.closed ? h('p', { text: '마무리된 모임입니다.' }) : h('div', { class: 'btns' }, [closeBtn]),
      block ? h('p', { class: 'block-why', text: block }) : null,
      h('div', { class: 'btns' }, [delBtn])
    ]);
  }

  function memberList(ms, byId, meId) {
    var order = { pending: 0, 'key-wait': 1, key: 2, daeri: 2, ok: 3, home: 4 };
    var sorted = ms.slice().sort(function (a, b) { return order[L.status(a)] - order[L.status(b)] || a.joinedAt - b.joinedAt; });
    return h('div', { class: 'block' }, [
      h('h2', { class: 'sub', text: '참가자 ' + ms.length + '명' }),
      ms.length ? h('ul', { class: 'mlist' }, sorted.map(function (m) {
        var st = L.status(m), detail = methodLabel(m.method) + (m.car === 'y' ? ' · 차 가져옴' : '');
        if (st === 'key-wait' && byId[m.keyTo]) detail += ' · ' + byId[m.keyTo].nick + '님에게 키 맡김';
        if ((st === 'key' || (st === 'home' && m.keyConfirmed)) && byId[m.keyTo]) detail += ' · ' + byId[m.keyTo].nick + '님이 키 보관';
        return h('li', { class: L.isUnresolved(st) ? 'unres' : null }, [
          h('span', { class: 'm-name' }, [h('b', { text: m.nick }), m.id === meId ? h('span', { class: 'tag', text: '나' }) : null, h('small', { text: detail })]),
          pill(st)
        ]);
      })) : h('p', { class: 'hint', text: '아직 참가한 사람이 없습니다. 참가 링크를 단체방에 올려 주세요.' })
    ]);
  }

  S.subscribe(function () { if (active && !busy) render(); });
  setInterval(function () { if (active && cur && !document.hidden) render(); }, 60000);   // 끝날 시간이 지나면 화면이 바뀌도록

  G.group = {
    show: function (on, target) {
      active = on;
      if (!on) { S.watch(null); return; }
      if (target) { if (cur !== target.code) $('group-root').replaceChildren(); cur = target.code; joinMode = target.join; }
      else { cur = null; joinMode = false; }
      render();
    }
  };
})();
