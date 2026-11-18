/* 설치형 앱의 새 버전 알림 — install.js 다음에 불러온다.
 * GitHub가 빌드할 때 app/build-www.mjs가 js/build.js에 빌드 번호를 넣는다(window.GWIGA_BUILD).
 * 앱이 열릴 때(6시간에 한 번) GitHub 릴리스를 확인해 더 새 버전이 있으면 위쪽 상자로 알려 준다.
 * 웹에서는 sw.js가 늘 최신 파일을 받으므로 이 파일은 아무것도 하지 않는다.
 */
(function () {
  var G = window.Gwiga, B = window.GWIGA_BUILD;
  if (!G.native || !B || !B.run || !window.fetch) return;

  var KEY = 'gwiga-update-check-v1', SKIP = 'gwiga-update-skip-v1';
  var API = 'https://api.github.com/repos/pjy04022-rgb/gwiga/releases/';
  var last = G.store.get(KEY) || 0;
  if (Date.now() - last < 6 * 3600000) return;

  function latest() {
    if (B.platform === 'android') {
      return fetch(API + 'latest').then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { var m = d && /^app-(\d+)$/.exec(d.tag_name || ''); return m ? +m[1] : 0; });
    }
    return fetch(API + 'tags/ios').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { var m = d && /빌드 (\d+)/.exec(d.body || ''); return m ? +m[1] : 0; });
  }

  setTimeout(function () {
    latest().then(function (n) {
      G.store.set(KEY, Date.now());
      if (!n || n <= B.run || G.store.get(SKIP) === n) return;
      var later = document.createElement('button');
      later.className = 'btn ghost small'; later.type = 'button'; later.textContent = '이 버전은 건너뛰기';
      later.addEventListener('click', function () { G.store.set(SKIP, n); G.$('install').hidden = true; });
      var get = document.createElement('a');
      get.className = 'btn amber';
      if (B.platform === 'android') { get.href = G.apkUrl; get.textContent = '새 버전 내려받기'; }
      else { get.href = G.ipaUrl; get.textContent = '새 설치 파일 내려받기 (.ipa)'; }
      G.install.fill({
        title: '새 버전이 나왔습니다',
        sub: B.platform === 'android'
          ? '내려받아 설치하면 지금 앱 위에 업데이트되고, 저장한 약속은 그대로 남습니다.'
          : '컴퓨터에서 새 설치 파일을 다시 서명해 설치하면 업데이트됩니다.',
        buttons: [get, later]
      });
    }, function () {});
  }, 2500);
})();
