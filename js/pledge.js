/* 귀가 서약 카드 */
(function () {
  var G = window.Gwiga, $ = G.$;
  var W = 1080, H = 1350;
  var C = { bg: '#16212B', amber: '#FFC24A', white: '#F3F5F7', soft: '#E6ECF1', muted: '#9AA8B5', line: '#2C3A47', dim: '#6E7D8B' };

  function text(p) {
    var sign = $('pl-sign').value.trim();
    var how = p.method === '근처 숙소' ? '근처에서 자고 가고 운전하지 않겠습니다.' : G.plan.phrase(p.method) + ' 귀가합니다.';
    return '[귀가약속] ' + G.korDate(p.date) + ' 술자리, 저는 ' + how +
      '\n' + p.end + '에 끝나면 이 약속을 지킬게요.' +
      (p.car === 'y' && p.method !== '대리운전' ? ' 차는 두고 갑니다.' : '') +
      '\n혹시 제가 운전대를 잡으려 하면 꼭 말려 주세요.' + (sign ? '\n- ' + sign : '');
  }

  function wrap(ctx, str, maxW) {
    var out = [], line = '';
    str.split(' ').forEach(function (w) {
      var t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    });
    if (line) out.push(line);
    return out;
  }

  function headLines(p) {
    if (p.method === '근처 숙소') return ['오늘은', '근처에서 자고', '운전하지 않습니다'];
    if (p.method === '걸어서') return ['오늘은', '걸어서', '귀가합니다'];
    if (p.method === '가족 차') return ['오늘은', '가족 차로', '귀가합니다'];
    return ['오늘은', p.method + G.ro(p.method), '귀가합니다'];
  }

  function paint(p) {
    var ctx = $('card').getContext('2d');
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.amber; ctx.fillRect(0, 0, 28, H);

    ctx.fillStyle = C.amber; ctx.font = '600 34px "IBM Plex Sans KR", sans-serif';
    ctx.fillText('귀가약속 · ' + G.korDate(p.date), 96, 140);

    ctx.font = '92px "Black Han Sans", sans-serif';
    var y = 330;
    headLines(p).forEach(function (l, i) {
      ctx.fillStyle = i === 1 ? C.amber : C.white;
      wrap(ctx, l, 880).forEach(function (s) { ctx.fillText(s, 96, y); y += 112; });
      y += 8;
    });

    ctx.strokeStyle = C.line; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(96, 760); ctx.lineTo(984, 760); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.font = '500 32px "IBM Plex Sans KR", sans-serif';
    ctx.fillText('술자리 끝', 96, 830); ctx.fillText('차', 560, 830);
    ctx.fillStyle = C.white; ctx.font = '600 60px "IBM Plex Mono", monospace';
    ctx.fillText(p.end, 96, 910);
    ctx.font = '700 52px "IBM Plex Sans KR", sans-serif';
    ctx.fillText(p.car === 'y' ? (p.method === '대리운전' ? '대리운전' : '두고 감') : '안 가져감', 560, 908);

    ctx.fillStyle = C.soft; ctx.font = '500 38px "IBM Plex Sans KR", sans-serif';
    wrap(ctx, '제가 운전대를 잡으려 하면 꼭 말려 주세요.', 880).forEach(function (s, i) { ctx.fillText(s, 96, 1040 + i * 56); });

    var sign = $('pl-sign').value.trim();
    if (sign) { ctx.fillStyle = C.amber; ctx.font = '700 40px "IBM Plex Sans KR", sans-serif'; ctx.fillText('— ' + sign, 96, 1200); }
    ctx.fillStyle = C.dim; ctx.font = '500 26px "IBM Plex Mono", monospace';
    ctx.fillText('단속 기준 0.03% · 다음 날 아침에도 남아 있을 수 있습니다', 96, 1280);
  }

  function draw() {
    var p = G.plan.current();
    $('pl-nosave').hidden = !!G.plan.get();
    $('pl-text').value = text(p);
    paint(p);
    if (document.fonts && document.fonts.load) {
      Promise.all([
        document.fonts.load('92px "Black Han Sans"'),
        document.fonts.load('700 40px "IBM Plex Sans KR"'),
        document.fonts.load('600 60px "IBM Plex Mono"')
      ]).then(function () { paint(p); }, function () {});
    }
  }

  function cardBlob() {
    return new Promise(function (res, rej) { $('card').toBlob(function (b) { b ? res(b) : rej(); }, 'image/png'); });
  }

  /* 공유: 휴대폰에서 바로 카카오톡 등으로 보내기 */
  var canShareFiles = false;
  if (!G.inArtifact && navigator.canShare) {
    try { canShareFiles = navigator.canShare({ files: [new File([new Blob(['x'])], 'x.png', { type: 'image/png' })] }); } catch (e) {}
  }
  $('pl-share').hidden = !canShareFiles;
  $('pl-share').addEventListener('click', function () {
    cardBlob().then(function (b) {
      var file = new File([b], '귀가약속-카드.png', { type: 'image/png' });
      return navigator.share({ files: [file], text: $('pl-text').value });
    }).catch(function (err) { if (err && err.name !== 'AbortError') G.toast('공유하지 못했습니다. 이미지 저장을 이용하세요.'); });
  });

  /* 이미지 저장 */
  if (G.inArtifact) G.artifactDownloads().then(function (d) { $('pl-save').hidden = !d; });
  else $('pl-save').hidden = false;
  $('pl-save').addEventListener('click', function () {
    cardBlob().then(function (b) { return G.saveFile('귀가약속-카드.png', b); })
      .then(function () { G.toast('카드 이미지를 저장했습니다.'); },
        function (err) { if (err && err.code === 'declined') return; G.toast('저장하지 못했습니다. 문구 복사를 이용하세요.'); });
  });

  $('pl-copy').addEventListener('click', function () { G.copyText($('pl-text').value, $('pl-text')); });
  $('pl-sign').addEventListener('input', draw);

  G.pledge = { draw: draw };
})();
