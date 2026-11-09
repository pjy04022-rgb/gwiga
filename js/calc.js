/* 숙취 계산기 화면 — 계산식은 model.js */
(function () {
  var G = window.Gwiga, $ = G.$, M = window.GwigaModel;
  var PREF = 'gwiga-calc-v1';
  var pref = G.store.get(PREF) || {};
  var counts = pref.counts || { soju_b: 1.5, beer_500: 1 };

  if (pref.sex) $('sex-' + pref.sex).checked = true;
  if (pref.weight) $('weight').value = pref.weight;

  function pad(n) { return G.pad(n); }
  function clock(m) { m = Math.round(m); var dd = Math.floor(m / 1440), mm = ((m % 1440) + 1440) % 1440; return (dd > 0 ? '다음날 ' : '') + pad(Math.floor(mm / 60)) + ':' + pad(mm % 60); }
  function short(m) { m = Math.round(m); var mm = ((m % 1440) + 1440) % 1440; return pad(Math.floor(mm / 60)) + ':' + pad(mm % 60); }
  function fmt(n) { return (Math.round(n * 10) / 10).toString(); }

  /* ---------- 술 목록 (+/- 버튼) ---------- */
  function renderDrinks() {
    var ul = $('drinks'); ul.innerHTML = '';
    M.DRINKS.forEach(function (d) {
      var n = counts[d.id] || 0;
      var li = document.createElement('li');
      li.className = 'drink' + (n > 0 ? ' on' : '');
      li.innerHTML =
        '<span class="drink-name"><b>' + d.name + '</b><small>' + d.unit + '</small></span>' +
        '<span class="stepper">' +
        '<button type="button" data-d="-1" aria-label="' + d.name + ' ' + d.unit + ' 줄이기"' + (n <= 0 ? ' disabled' : '') + '>−</button>' +
        '<output id="cnt-' + d.id + '" aria-label="' + d.name + ' ' + d.unit + ' 수량">' + fmt(n) + '</output>' +
        '<button type="button" data-d="1" aria-label="' + d.name + ' ' + d.unit + ' 늘리기">+</button>' +
        '</span>';
      li.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          var v = Math.max(0, Math.min(30, (counts[d.id] || 0) + (+b.dataset.d) * d.step));
          counts[d.id] = Math.round(v * 10) / 10;
          if (!counts[d.id]) delete counts[d.id];
          renderDrinks(); calc(); savePref();
        });
      });
      ul.appendChild(li);
    });
  }

  function savePref() {
    G.store.set(PREF, { sex: document.querySelector('input[name=sex]:checked').value, weight: $('weight').value, counts: counts });
  }

  /* ---------- 계산과 표시 ---------- */
  function calc() {
    var r = M.model({
      sex: document.querySelector('input[name=sex]:checked').value,
      weight: parseFloat($('weight').value),
      counts: counts,
      start: $('t-start').value, end: $('t-end').value, drive: $('t-drive').value
    });
    var base = r.s - r.s % 1440;
    $('drink-total').textContent = '· 순알코올 ' + Math.round(r.grams) + 'g';
    $('r-drive').textContent = short(r.d);
    $('lcd').innerHTML = r.atDrive.toFixed(3) + '<small>%</small>';
    $('f-peak').textContent = r.peakCon.toFixed(3) + '%';
    $('f-03').textContent = r.t03 === null ? '해당 없음' : clock(r.t03 - base);
    $('f-zero').textContent = r.grams > 0 ? clock(r.t0 - base) : '해당 없음';

    var v = $('verdict'), mini;
    if (r.atDrive >= 0.08) {
      v.className = 'verdict v-danger';
      v.innerHTML = '<strong>면허 취소 수준이 남아 있을 수 있습니다</strong>분해가 느린 사람이라면 운전 예정 시각에 0.08% 이상으로 추정됩니다. 평균적인 사람 기준 추정치는 ' + r.atDriveAvg.toFixed(3) + '%입니다. 운전 계획을 바꾸세요.';
      mini = '면허 취소 수준이 남아 있을 수 있습니다';
    } else if (r.atDrive >= 0.03) {
      v.className = 'verdict v-danger';
      v.innerHTML = '<strong>단속 기준 0.03%를 넘을 수 있습니다</strong>분해가 느린 사람이라면 면허 정지 구간입니다. 평균적인 사람 기준 추정치는 ' + r.atDriveAvg.toFixed(3) + '%입니다. 운전 계획을 바꾸세요.';
      mini = '단속 기준을 넘을 수 있습니다';
    } else if (r.atDrive > 0) {
      v.className = 'verdict v-warn';
      v.innerHTML = '<strong>알코올이 아직 남아 있을 수 있습니다</strong>기준 아래로 추정되더라도 운전해도 된다는 뜻이 아닙니다. 개인차가 크고, 낮은 농도에서도 판단력과 반응 속도가 떨어집니다.';
      mini = '알코올이 남아 있을 수 있습니다';
    } else {
      v.className = 'verdict v-warn';
      v.innerHTML = '<strong>계산상 수치가 0이어도 판정이 아닙니다</strong>이 앱은 운전 가능 여부를 알려주지 않습니다. 잠이 부족하거나 속이 불편하다면 운전하지 마세요.';
      mini = '추정치일 뿐, 판정이 아닙니다';
    }
    $('mini-v').textContent = r.atDrive.toFixed(3) + '%';
    $('mini-t').textContent = short(r.d) + ' 추정 · ' + mini;
    $('mini').classList.toggle('danger', r.atDrive >= 0.03);
    drawChart(r);
  }

  function drawChart(r) {
    var W = 600, H = 260, L = 46, R = 14, T = 14, B = 30, x0 = r.s, x1 = Math.max(r.t0, r.d) + 60;
    var yMax = Math.max(0.1, Math.ceil(r.peakCon * 100 / 2) * 2 / 100 + 0.02);
    function X(t) { return L + (t - x0) / (x1 - x0) * (W - L - R); }
    function Y(c) { return T + (1 - c / yMax) * (H - T - B); }
    var o = '', step = yMax > 0.2 ? 0.05 : 0.02, c, t;
    for (c = 0; c <= yMax + 1e-9; c += step) {
      o += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(c) + '" y2="' + Y(c) + '" style="stroke:var(--panel-line)" stroke-width="1"/>';
      o += '<text x="' + (L - 6) + '" y="' + (Y(c) + 4) + '" text-anchor="end" font-size="11" style="fill:var(--panel-muted);font-family:var(--mono)">' + c.toFixed(2) + '</text>';
    }
    var span = x1 - x0, every = span > 1200 ? 240 : (span > 600 ? 120 : 60);
    for (t = Math.ceil(x0 / every) * every; t <= x1; t += every) {
      o += '<text x="' + X(t) + '" y="' + (H - 10) + '" text-anchor="middle" font-size="11" style="fill:var(--panel-muted);font-family:var(--mono)">' + short(t) + '</text>';
    }
    [[0.03, '0.03 정지'], [0.08, '0.08 취소'], [0.2, '0.2']].forEach(function (th) {
      if (th[0] < yMax) {
        o += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(th[0]) + '" y2="' + Y(th[0]) + '" style="stroke:var(--limit)" stroke-width="1.2" stroke-dasharray="2 4"/>';
        o += '<text x="' + (W - R - 2) + '" y="' + (Y(th[0]) - 5) + '" text-anchor="end" font-size="11" style="fill:var(--limit)">' + th[1] + '</text>';
      }
    });
    function path(peak, beta) {
      var pts = [], n = 120, i, tt;
      for (i = 0; i <= n; i++) { tt = x0 + (x1 - x0) * i / n; pts.push([X(tt), Y(r.bac(tt, peak, beta))]); }
      pts.push([X(r.e), Y(peak)]);
      pts.sort(function (a, b) { return a[0] - b[0]; });
      return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L');
    }
    o += '<path d="' + path(r.peakAvg, r.betaAvg) + '" style="fill:none;stroke:var(--avg)" stroke-width="2" stroke-dasharray="6 5"/>';
    var pc = path(r.peakCon, r.betaCon);
    o += '<path d="' + pc + ' L' + X(x1) + ',' + Y(0) + ' L' + X(x0) + ',' + Y(0) + ' Z" style="fill:var(--amber);fill-opacity:.1"/>';
    o += '<path d="' + pc + '" style="fill:none;stroke:var(--amber)" stroke-width="2.5"/>';
    o += '<line x1="' + X(r.d) + '" x2="' + X(r.d) + '" y1="' + T + '" y2="' + (H - B) + '" style="stroke:var(--panel-ink)" stroke-width="1" stroke-dasharray="3 3"/>';
    o += '<circle cx="' + X(r.d) + '" cy="' + Y(r.atDrive) + '" r="5" style="fill:var(--amber);stroke:var(--panel)" stroke-width="2"/>';
    var right = X(r.d) > W - 130, lx = right ? X(r.d) - 6 : X(r.d) + 6;
    o += '<text x="' + lx + '" y="' + (T + 12) + '" text-anchor="' + (right ? 'end' : 'start') + '" font-size="12" style="fill:var(--panel-ink)">운전 예정 ' + short(r.d) + '</text>';
    $('chart').innerHTML = o;
  }

  /* ---------- 저장된 약속의 시각 불러오기 ---------- */
  var filledFor = null;
  function prefill() {
    var p = G.plan.get();
    if (!p) return;
    var k = JSON.stringify(p);
    if (filledFor === k) return;
    filledFor = k;
    $('t-start').value = p.start; $('t-end').value = p.end;
    if (p.drv === 'y') $('t-drive').value = p.drive;
    calc();
  }

  /* ---------- 휴대폰: 결과가 화면 밖이면 아래에 요약 막대 ---------- */
  var resultVisible = true, active = false;
  function syncMini() { $('mini').hidden = !active || resultVisible; }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { resultVisible = es[0].isIntersecting; syncMini(); }, { threshold: 0.15 }).observe($('result'));
  }
  $('mini').addEventListener('click', function (e) { e.preventDefault(); $('result').scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  $('calc-form').addEventListener('input', function () { calc(); savePref(); });
  $('calc-form').addEventListener('submit', function (e) { e.preventDefault(); });

  G.calc = {
    init: function () { renderDrinks(); calc(); },
    show: function (on) { active = on; if (on) prefill(); syncMini(); }
  };
})();
