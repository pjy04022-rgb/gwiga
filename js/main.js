/* 화면 전환과 시작
 * 주소 끝(#)으로 화면을 고른다: #plan #group #pledge #check #law
 * 모임은 #room-코드(현황판), #join-코드(참가 화면)
 */
(function () {
  var G = window.Gwiga;
  var VIEWS = ['plan', 'group', 'pledge', 'check', 'law'];
  var current = null;

  function route() {
    var h = location.hash.replace('#', '');
    var m = h.match(/^(room|join)-([A-Z0-9]{6})$/);
    var view = m ? 'group' : h;
    if (VIEWS.indexOf(view) < 0) view = 'plan';

    document.querySelectorAll('[data-view]').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== view; });
    document.querySelectorAll('[data-tab]').forEach(function (a) {
      if (a.getAttribute('data-tab') === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (view === 'pledge') G.pledge.draw();
    G.calc.show(view === 'check');
    G.group.show(view === 'group', m ? { code: m[2], join: m[1] === 'join' } : null);
    if (current !== null && current !== h) window.scrollTo(0, 0);
    current = h;
  }

  window.addEventListener('hashchange', route);
  G.on('plan', function () { if (location.hash === '#pledge') G.pledge.draw(); });

  G.plan.init();
  G.calc.init();
  route();

  /* 오프라인 사용·홈 화면 설치 (일반 웹 주소에서만) */
  if ('serviceWorker' in navigator && !G.inArtifact && !G.native && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
