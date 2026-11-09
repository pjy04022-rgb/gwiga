/* 모임 모드 화면 — 규칙은 group-logic.js, 저장은 group-store.js */
(function () {
  var G = window.Gwiga, $ = G.$, L = window.GwigaGroup, S = G.groupStore;

  var active = false;
  var cur = null;          // 보고 있는 방 코드 (null이면 목록)
  var joinMode = false;    // 참가 화면을 보는 중
  var viewAs = {};         // 시연: 방 코드 → 'host' | 참가자 id
  var simEnd = {};         // 시연: 방 코드 → 끝난 것으로 보기
  var renderSeq = 0;

  /* ---------- 작은 도우미 ---------- */
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
  function isEnded(r) { return !!simEnd[r.code] || Date.now() >= L.endAt(r); }
  function pill(st) { var s = L.STATUS[st]; return h('span', { class: 'gpill t-' + s.tone, text: s.label }); }
  function go(hash) { if (location.hash === '#' + hash) render(); else location.hash = hash; }
  function errMsg(e) { return (e && e.errors && e.errors.join(' ')) || '저장하지 못했습니다. 다시 시도해 주세요.'; }

  function viewer(r) {
    var v = viewAs[r.code];
    if (v && (v === 'host' ? r.host : r.members.some(function (m) { return m.id === v; }))) return v;
    if (r.me && r.members.some(function (m) { return m.id === r.me; })) return r.me;
    return r.host ? 'host' : null;
  }

  /* ---------- 그리기 ---------- */
  function render() {
    if (!active) return;
    var seq = ++renderSeq, root = $('group-root');
    if (!cur) {
      S.listRooms().then(function (rooms) { if (seq === renderSeq) root.replaceChildren(listView(rooms)); });
      return;
    }
    S.getRoom(cur).then(function (r) {
      if (seq !== renderSeq) return;
      if (!r) { root.replaceChildren(missingView()); return; }
      if (joinMode || (!r.host && !r.me)) root.replaceChildren(joinView(r));
      else root.replaceChildren(boardView(r));
    });
  }

  /* ---------- 1. 모임 목록과 만들기 ---------- */
  function listView(rooms) {
    var title = h('input', { type: 'text', id: 'g-title', maxlength: '30', placeholder: '예: 경찰학과 개강총회' });
    var date = h('input', { type: 'date', id: 'g-date', value: G.todayStr() });
    var start = h('input', { type: 'time', id: 'g-start', value: '19:00' });
    var end = h('input', { type: 'time', id: 'g-end', value: '23:00' });
    var err = h('p', { class: 'form-err', role: 'alert' });

    var form = h('form', { class: 'panel', autocomplete: 'off', onsubmit: function (e) {
      e.preventDefault();
      if (!L.cleanNick(title.value)) { err.textContent = '모임 이름을 적어 주세요.'; title.focus(); return; }
      S.createRoom({ title: title.value, date: date.value || G.todayStr(), start: start.value || '19:00', end: end.value || '23:00' })
        .then(function (r) { viewAs[r.code] = 'host'; G.toast('모임을 만들었습니다. 참가 링크를 보내세요.'); go('room-' + r.code); });
    } }, [
      h('h2', { class: 'sub', text: '총무라면 모임을 만드세요' }),
      h('label', { for: 'g-title' }, ['모임 이름', title]),
      h('div', { class: 'row3' }, [h('label', { for: 'g-date' }, ['날짜', date]), h('label', { for: 'g-start' }, ['시작', start]), h('label', { for: 'g-end' }, ['끝날 예정', end])]),
      err,
      h('div', { class: 'btns' }, [h('button', { class: 'btn', type: 'submit', text: '모임 만들기' })])
    ]);

    var demo = h('div', { class: 'panel demo-card' }, [
      h('h2', { class: 'sub', text: '먼저 둘러보기' }),
      h('p', { text: '참가자 다섯 명이 있는 예시 모임을 만들어, 총무 화면과 참가자 화면을 번갈아 볼 수 있습니다.' }),
      h('div', { class: 'btns' }, [h('button', { class: 'btn ghost', type: 'button', text: '예시 모임 열기', onclick: seedExample })])
    ]);

    var list = rooms.length ? h('div', { class: 'block' }, [
      h('h2', { class: 'sub', text: '이 기기의 모임' }),
      h('ul', { class: 'room-list' }, rooms.map(function (r) {
        var s = L.summary(r.members);
        return h('li', null, [h('a', { href: '#room-' + r.code }, [
          h('span', { class: 'rl-main' }, [h('b', { text: r.title }), r.example ? h('span', { class: 'tag', text: '예시' }) : null]),
          h('span', { class: 'rl-sub', text: timeRange(r) + ' · ' + (r.host ? '총무' : '참가') + ' · 참가 ' + s.total + '명' + (s.unresolved ? ' · 미확인 ' + s.unresolved + '명' : '') })
        ])]);
      }))
    ]) : null;

    return h('div', { class: 'stack' }, [
      h('div', { class: 'head' }, [
        h('span', { class: 'eyebrow', text: '모임 모드 · 함께 마시는 사람끼리' }),
        h('h1', { html: '귀가 방법을 정해야<br><em>모임에 들어올 수 있습니다</em>' }),
        h('p', { class: 'lead', text: '혼자 하는 약속은 잊기 쉽습니다. 총무가 모임을 만들면 참가자 모두가 귀가 방법을 정해야 하고, 차를 가져온 사람은 친구가 확인할 때까지 총무 화면에 미확인으로 남습니다.' })
      ]),
      flowSteps(),
      h('div', { class: 'grid-2' }, [form, demo]),
      list,
      h('p', { class: 'caution', text: '지금은 이 기기 안에서만 동작하는 시연판입니다. 여러 사람이 각자 휴대폰으로 참가하려면 서버 연결이 필요합니다.' })
    ]);
  }

  function flowSteps() {
    var items = [
      ['총무가 모임을 만듭니다', '날짜와 끝날 시간을 정하고 참가 링크를 단체방에 올립니다.'],
      ['귀가 방법을 골라야 참가', '별명, 귀가 방법, 차를 가져오는지 모두 골라야 참가할 수 있습니다.'],
      ['차는 친구가 확인', '키를 맡긴 친구가 "받았어요"를 누르기 전까지 미확인으로 남습니다.'],
      ['미확인 0명이어야 마무리', '술자리가 끝나고 모든 차가 확인돼야 총무가 모임을 마무리합니다.']
    ];
    return h('ol', { class: 'gflow' }, items.map(function (it, i) {
      return h('li', null, [h('i', { text: String(i + 1) }), h('b', { text: it[0] }), h('span', { text: it[1] })]);
    }));
  }

  function seedExample() {
    S.createRoom({ title: '경찰학과 개강총회', date: G.todayStr(), start: '19:00', end: '23:00', example: true }).then(function (r) {
      var people = [
        { nick: '민수', method: '택시', car: 'n' },
        { nick: '지현', method: '대리운전', car: 'y' },
        { nick: '태호', method: '택시', car: 'y' },
        { nick: '서연', method: '심야버스·지하철', car: 'n' },
        { nick: '준', method: '걸어서', car: 'y' }
      ];
      var ids = {};
      return people.reduce(function (p, d) {
        return p.then(function () { return S.addMember(r.code, Object.assign({ example: true }, d)).then(function (m) { ids[d.nick] = m.id; }); });
      }, Promise.resolve()).then(function () {
        return S.updateMember(r.code, ids['태호'], { keyTo: ids['민수'] });
      }).then(function () {
        viewAs[r.code] = 'host';
        G.toast('예시 모임을 열었습니다. 위쪽에서 누구 화면으로 볼지 바꿔 보세요.');
        go('room-' + r.code);
      });
    });
  }

  function missingView() {
    return h('div', { class: 'stack' }, [
      h('div', { class: 'head' }, [
        h('span', { class: 'eyebrow', text: '모임 모드' }),
        h('h1', { text: '모임을 찾을 수 없습니다' }),
        h('p', { class: 'lead', text: '끝난 지 하루가 지나 자동으로 지워졌거나, 다른 기기에서 만든 모임입니다. 시연판에서는 모임을 만든 기기에서만 열 수 있습니다.' })
      ]),
      h('div', { class: 'btns' }, [h('a', { class: 'btn', href: '#group', text: '모임 목록으로' })])
    ]);
  }

  /* ---------- 2. 참가 (모두 골라야 참가 가능) ---------- */
  function joinView(r) {
    var nick = h('input', { type: 'text', id: 'j-nick', maxlength: '12', placeholder: '예: 경찰학과 24학번', autocomplete: 'off' });
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
      var d = val();
      S.addMember(r.code, d).then(function (m) {
        joinMode = false; viewAs[r.code] = m.id;
        G.toast(m.nick + '님, 참가했습니다.');
        go('room-' + r.code);
      }, function (e2) { err.textContent = errMsg(e2); });
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
        h('p', { class: 'lead', text: timeRange(r) + ' · 총무가 만든 모임입니다. 세 가지를 모두 골라야 참가할 수 있습니다.' })
      ]),
      r.closed ? h('p', { class: 'caution', text: '이미 마무리된 모임이라 참가할 수 없습니다.' }) : form
    ]);
  }

  /* ---------- 3. 모임 현황판 ---------- */
  function boardView(r) {
    var ms = r.members, ended = isEnded(r), sum = L.summary(ms), v = viewer(r);
    var me = ms.filter(function (m) { return m.id === v; })[0] || null;
    var byId = {}; ms.forEach(function (m) { byId[m.id] = m; });
    var parts = [];

    parts.push(h('div', { class: 'head' }, [
      h('span', { class: 'eyebrow' }, ['모임 · 코드 ' + r.code, r.example ? h('span', { class: 'tag', text: '예시 데이터' }) : null]),
      h('h1', { text: r.title }),
      h('p', { class: 'lead', text: timeRange(r) + (r.closed ? ' · 마무리됨' : ended ? ' · 끝날 시간이 지났습니다' : '') })
    ]));

    if (S.mode === 'local') parts.push(demoBar(r, v, ended));

    if (ended) parts.push(endBanner(r, sum, byId));

    parts.push(h('dl', { class: 'gstats' }, [
      stat('참가', sum.total + '명'), stat('차 가져옴', sum.cars + '대'),
      stat('미확인', sum.unresolved + '명', sum.unresolved ? 'bad' : ''), stat('귀가 완료', sum.home + '명')
    ]));

    /* 나에게 온 키 확인 요청 */
    if (me) ms.filter(function (o) { return o.keyTo === me.id && !o.keyConfirmed && !o.home; }).forEach(function (o) {
      parts.push(h('div', { class: 'request' }, [
        h('p', null, [h('b', { text: o.nick + '님' }), '이 차 키를 맡겼다고 합니다. 키를 직접 받았나요?']),
        h('div', { class: 'btns' }, [
          h('button', { class: 'btn', type: 'button', text: '받았어요', onclick: function () {
            S.updateMember(r.code, o.id, { keyConfirmed: true }).then(function () { G.toast(o.nick + '님 차 키를 확인했습니다.'); });
          } }),
          h('button', { class: 'btn ghost', type: 'button', text: '아직 안 받았어요', onclick: function () {
            S.updateMember(r.code, o.id, { keyTo: null }).then(function () { G.toast(o.nick + '님에게 다시 맡기라고 알려 주세요.'); });
          } })
        ])
      ]));
    });

    if (me) parts.push(myCard(r, me, ms, byId, ended));
    if (v === 'host') parts.push(hostCard(r, ms, ended));
    if (!me && v !== 'host') parts.push(h('div', { class: 'btns' }, [h('a', { class: 'btn', href: '#join-' + r.code, text: '이 모임에 참가하기' })]));

    parts.push(memberList(r, ms, byId, v));

    if (ended && sum.cars) parts.push(h('a', { class: 'action', href: '#check' }, [
      h('b', { text: '내일 차를 찾기 전에 숙취 확인' }),
      h('span', { text: '차를 가져온 사람은 다음 날 아침에도 알코올이 남아 있을 수 있습니다.' })
    ]));

    parts.push(h('div', { class: 'btns' }, [h('a', { class: 'btn ghost', href: '#group', text: '모임 목록' })]));
    parts.push(h('p', { class: 'hint', text: '별명, 귀가 방법, 차 여부만 저장하며 모임이 끝난 다음 날 자동으로 지워집니다.' }));

    return h('div', { class: 'stack' }, parts);
  }

  function stat(k, v, cls) { return h('div', { class: cls || null }, [h('dt', { text: k }), h('dd', { text: v })]); }

  function demoBar(r, v, ended) {
    var sel = h('select', { id: 'g-viewas', 'aria-label': '누구 화면으로 볼지', onchange: function () { viewAs[r.code] = sel.value; render(); } });
    if (r.host) sel.appendChild(h('option', { value: 'host', text: '총무 화면', selected: v === 'host' }));
    r.members.forEach(function (m) { sel.appendChild(h('option', { value: m.id, text: m.nick + ' 화면', selected: v === m.id })); });
    return h('div', { class: 'demo-bar' }, [
      h('span', { class: 'demo-l', text: '시연' }),
      h('label', { for: 'g-viewas', class: 'demo-sel' }, ['누구 화면으로 볼까요', sel]),
      h('div', { class: 'btns' }, [
        r.closed ? null : h('button', { class: 'btn ghost small', type: 'button', text: '새 참가자로 참가해 보기', onclick: function () { joinMode = true; go('join-' + r.code); } }),
        Date.now() >= L.endAt(r) ? null : h('button', { class: 'btn ghost small', type: 'button', text: ended ? '끝나기 전으로 되돌리기' : '끝날 시간으로 건너뛰기', onclick: function () { simEnd[r.code] = !simEnd[r.code]; render(); } })
      ])
    ]);
  }

  function endBanner(r, sum, byId) {
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

    if (st === 'pending' || st === 'key-wait') {
      if (st === 'key-wait') {
        body.push(h('p', { class: 'my-note', text: (byId[me.keyTo] ? byId[me.keyTo].nick : '친구') + '님이 "받았어요"를 누르면 확인됩니다.' }));
        body.push(h('div', { class: 'btns' }, [h('button', { class: 'btn ghost on-dark small', type: 'button', text: '다른 친구에게 맡기기', onclick: function () { S.updateMember(r.code, me.id, { keyTo: null }); } })]));
      } else {
        var others = ms.filter(function (m) { return m.id !== me.id; });
        body.push(h('p', { class: 'my-note', text: '차를 가져와 미확인 상태입니다. 함께 있는 친구에게 키를 맡기고 확인을 받으세요.' }));
        if (others.length) {
          var sel = h('select', { id: 'g-keyto', 'aria-label': '키를 맡길 친구' }, others.map(function (o) { return h('option', { value: o.id, text: o.nick }); }));
          body.push(h('div', { class: 'keyrow' }, [sel, h('button', { class: 'btn amber', type: 'button', text: '이 친구에게 키 맡기기', onclick: function () {
            S.updateMember(r.code, me.id, { keyTo: sel.value }).then(function () { G.toast('친구가 "받았어요"를 누르면 확인됩니다.'); });
          } })]));
        } else body.push(h('p', { class: 'my-note', text: '함께 있는 친구가 참가하면 키를 맡길 수 있습니다.' }));
      }
      if (me.method === '대리운전') {
        body.push(h('div', { class: 'btns' }, [h('button', { class: 'btn ghost on-dark', type: 'button', text: '대리 기사 만났어요', disabled: !ended, onclick: function () {
          S.updateMember(r.code, me.id, { daeriMet: true }).then(function () { G.toast('대리운전으로 확인됐습니다.'); });
        } })]));
        if (!ended) body.push(h('p', { class: 'my-note dim', text: '"대리 기사 만났어요"는 술자리가 끝난 뒤 누를 수 있습니다.' }));
      }
      body.push(h('p', { class: 'my-note dim', text: '미확인 상태에서는 "집에 도착했어요"를 누를 수 없습니다.' }));
    } else if (st === 'home') {
      body.push(h('p', { class: 'my-note', text: '귀가 완료를 알렸습니다. 수고하셨습니다.' }));
    } else {
      if (L.canGoHome(me, ended)) body.push(h('button', { class: 'btn amber block', type: 'button', text: '집에 도착했어요', onclick: function () {
        S.updateMember(r.code, me.id, { home: true }).then(function () { G.toast('귀가 완료를 알렸습니다.'); });
      } }));
      else body.push(h('p', { class: 'my-note', text: '술자리가 끝나면 이 자리에 "집에 도착했어요" 버튼이 나타납니다.' }));
    }
    return h('div', { class: 'promise mycard' }, body);
  }

  function hostCard(r, ms, ended) {
    var link = location.href.split('#')[0] + '#join-' + r.code;
    var block = r.closed ? '' : L.closeBlock(ms, ended);
    var delArmed = false;
    var delBtn = h('button', { class: 'btn ghost danger small', type: 'button', text: '모임 지우기', onclick: function () {
      if (!delArmed) { delArmed = true; delBtn.textContent = '한 번 더 누르면 지웁니다'; return; }
      S.deleteRoom(r.code).then(function () { G.toast('모임을 지웠습니다.'); go('group'); });
    } });
    return h('div', { class: 'panel hostcard' }, [
      h('h2', { class: 'sub', text: '총무 · 참가 링크' }),
      h('div', { class: 'linkrow' }, [
        h('input', { type: 'text', id: 'g-link', readonly: true, value: link, 'aria-label': '참가 링크' }),
        h('button', { class: 'btn small', type: 'button', text: '복사', onclick: function () { G.copyText(link, $('g-link')); } })
      ]),
      S.mode === 'local' ? h('p', { class: 'hint', text: '시연판에서는 이 링크가 모임을 만든 기기에서만 열립니다. 위쪽 "새 참가자로 참가해 보기"로 참가 과정을 확인하세요.' }) : null,
      h('h2', { class: 'sub', text: '모임 마무리' }),
      r.closed ? h('p', { text: '마무리된 모임입니다.' }) : h('div', { class: 'btns' }, [
        h('button', { class: 'btn', type: 'button', text: '모임 마무리', disabled: !!block, onclick: function () {
          S.closeRoom(r.code).then(function () { G.toast('모임을 마무리했습니다.'); });
        } })
      ]),
      block ? h('p', { class: 'block-why', text: block }) : null,
      h('div', { class: 'btns' }, [delBtn])
    ]);
  }

  function memberList(r, ms, byId, v) {
    var order = { pending: 0, 'key-wait': 1, key: 2, daeri: 2, ok: 3, home: 4 };
    var sorted = ms.slice().sort(function (a, b) { return order[L.status(a)] - order[L.status(b)] || a.joinedAt - b.joinedAt; });
    return h('div', { class: 'block' }, [
      h('h2', { class: 'sub', text: '참가자 ' + ms.length + '명' }),
      ms.length ? h('ul', { class: 'mlist' }, sorted.map(function (m) {
        var st = L.status(m), detail = methodLabel(m.method) + (m.car === 'y' ? ' · 차 가져옴' : '');
        if (st === 'key-wait' && byId[m.keyTo]) detail += ' · ' + byId[m.keyTo].nick + '님에게 키 맡김';
        if (st === 'key' && byId[m.keyTo]) detail += ' · ' + byId[m.keyTo].nick + '님이 키 보관';
        return h('li', { class: L.isUnresolved(st) ? 'unres' : null }, [
          h('span', { class: 'm-name' }, [h('b', { text: m.nick }), m.id === v ? h('span', { class: 'tag', text: '나' }) : null, h('small', { text: detail })]),
          pill(st)
        ]);
      })) : h('p', { class: 'hint', text: '아직 참가한 사람이 없습니다. 참가 링크를 단체방에 올려 주세요.' })
    ]);
  }

  S.subscribe(function () { if (active) render(); });
  setInterval(function () { if (active && cur) render(); }, 60000);   // 끝날 시간이 지나면 화면이 바뀌도록

  G.group = {
    show: function (on, target) {
      active = on;
      if (!on) return;
      if (target) { cur = target.code; joinMode = target.join; }
      else { cur = null; joinMode = false; }
      render();
    }
  };
})();
