/* 공용 함수 — 다른 스크립트보다 먼저 불러온다 */
(function () {
  var G = (window.Gwiga = window.Gwiga || {});

  G.$ = function (id) { return document.getElementById(id); };

  /* 화면끼리 알리기: G.on('plan', fn) / G.emit('plan') */
  var handlers = {};
  G.on = function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); };
  G.emit = function (name) { (handlers[name] || []).forEach(function (fn) { fn(); }); };

  /* 저장소: 이 기기의 브라우저에만 저장. 막혀 있어도 앱은 동작한다. */
  G.store = {
    get: function (k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set: function (k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  G.pad = function (n) { return String(n).padStart(2, '0'); };
  G.todayStr = function () { var d = new Date(); return d.getFullYear() + '-' + G.pad(d.getMonth() + 1) + '-' + G.pad(d.getDate()); };
  G.korDate = function (s) { var p = s.split('-'); return (+p[1]) + '월 ' + (+p[2]) + '일'; };

  /* 조사 '로/으로': 받침이 없거나 ㄹ 받침이면 '로' */
  G.ro = function (w) {
    var c = w.charCodeAt(w.length - 1) - 0xac00;
    if (c < 0 || c > 11171) return '로';
    var f = c % 28;
    return f === 0 || f === 8 ? '로' : '으로';
  };

  var toastTimer;
  G.toast = function (msg) {
    var t = G.$('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  };

  /* claude.ai 아티팩트 안에서 실행 중인지 (파일 저장·공유 방식이 다름) */
  G.inArtifact = !!(window.claude && typeof window.claude.use === 'function');

  var dlPromise = null;
  function artifactDownloads() {
    if (!G.inArtifact) return Promise.resolve(null);
    if (!dlPromise) dlPromise = window.claude.use('downloads').catch(function () { return null; });
    return dlPromise;
  }
  G.artifactDownloads = artifactDownloads;

  /* 파일 저장: 아티팩트면 플랫폼 저장 기능, 아니면 일반 다운로드 */
  G.saveFile = function (filename, blob) {
    return artifactDownloads().then(function (dl) {
      if (dl) return dl.save({ filename: filename, data: blob });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return { status: 'saved' };
    });
  };

  G.copyText = function (text, fallbackEl) {
    function fallback() {
      if (fallbackEl) { fallbackEl.focus(); fallbackEl.select(); }
      G.toast('문구를 선택했습니다. 길게 눌러 복사하세요.');
    }
    try { navigator.clipboard.writeText(text).then(function () { G.toast('문구를 복사했습니다.'); }, fallback); }
    catch (e) { fallback(); }
  };
})();
