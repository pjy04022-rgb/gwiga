/* 앱 받기 안내 — native.js 다음에 불러온다.
 *   웹으로 들어온 휴대폰에는 그 휴대폰에 맞는 안내를 처음에 한 번 띄운다(닫으면 다시 자동으로 뜨지 않음).
 *   위쪽 "앱 받기" 버튼으로 언제든 다시 열 수 있고, 안드로이드·아이폰 안내를 바꿔 볼 수 있다(발표·친구 안내용).
 *   설치형 앱(G.native)과 claude.ai 미리보기에서는 보이지 않는다. 설치형 앱의 새 버전 알림은 update.js가 이 상자를 쓴다.
 */
(function () {
  var G = window.Gwiga, $ = G.$;
  G.ipaUrl = 'https://github.com/pjy04022-rgb/gwiga/releases/download/ios/gwiga.ipa';

  var ua = navigator.userAgent;
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var standalone = navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  G.device = { ios: isIOS, android: isAndroid, standalone: standalone };

  var KEY = 'gwiga-install-closed-v1';
  var box = $('install');

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }  // 고정 문구만
  function link(cls, href, text) { var a = el('a', cls); a.href = href; a.textContent = text; return a; }

  /* 상자 내용 채우기: { title, sub, steps:[html], buttons:[node], tabs:bool, platform } */
  function fill(o) {
    $('ins-title').textContent = o.title;
    $('ins-sub').textContent = o.sub || '';
    $('ins-steps').replaceChildren.apply($('ins-steps'), (o.steps || []).map(function (s) { return el('li', null, s); }));
    $('ins-steps').hidden = !(o.steps && o.steps.length);
    $('ins-btns').replaceChildren.apply($('ins-btns'), o.buttons || []);
    var tabs = $('ins-tabs');
    tabs.hidden = !o.tabs;
    tabs.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.p === o.platform)); });
    box.hidden = false;
  }

  function android() {
    fill({ tabs: true, platform: 'android', title: '안드로이드 앱으로 받기',
      sub: '앱을 꺼 두어도 술자리 끝날 시간에 알림이 화면 위로 뜹니다.',
      steps: ['아래 <b>앱 내려받기</b>를 누릅니다.', '처음이면 <b>출처를 알 수 없는 앱 설치</b>를 허용하고 설치합니다.',
        '이미 설치했다면 새로 받은 파일을 그대로 설치하면 업데이트됩니다.'],
      buttons: [link('btn amber', G.apkUrl, '앱 내려받기 (APK)')] });
  }
  function iphone() {
    var more = el('details', 'ins-more', '<summary>컴퓨터로 앱 설치하기 (설치 파일 .ipa)</summary>' +
      '<p>Windows나 Mac에서 Sideloadly 같은 도구로 본인 Apple ID로 서명해 설치합니다. 무료 Apple ID로는 7일마다 다시 설치해야 합니다. 이렇게 설치하면 앱을 꺼 두어도 알림이 울립니다.</p>');
    more.append(link('btn ghost small', G.ipaUrl, '설치 파일 내려받기 (.ipa)'));
    fill({ tabs: true, platform: 'ios', title: '아이폰에서 앱처럼 쓰기',
      sub: '아이폰은 웹에서 앱 파일을 바로 설치할 수 없어, 홈 화면에 추가해 앱처럼 씁니다.',
      steps: ['Safari로 이 주소를 열고 아래쪽 <b>공유 버튼</b>(네모에 위쪽 화살표)을 누릅니다.',
        '목록에서 <b>홈 화면에 추가</b> → <b>추가</b>를 누릅니다.',
        '홈 화면의 <b>귀가약속</b> 아이콘으로 열고, 약속을 저장할 때 알림을 허용합니다. (iOS 16.4 이상)'],
      buttons: [more] });
  }
  function open(platform) { (platform === 'ios' ? iphone : android)(); }

  G.install = {
    fill: fill,
    open: function (platform) { open(platform || (isIOS ? 'ios' : 'android')); window.scrollTo(0, 0); }
  };

  $('ins-tabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-p]'); if (b) open(b.dataset.p); });
  $('ins-close').addEventListener('click', function () { box.hidden = true; G.store.set(KEY, true); });

  if (G.native || G.inArtifact) return;
  $('getapp').hidden = false;
  $('getapp').addEventListener('click', function () { G.install.open(); });

  /* 처음 들어온 휴대폰에는 자동으로 한 번 (홈 화면에서 연 웹앱은 이미 설치한 것이므로 제외) */
  if (!standalone && (isIOS || isAndroid) && !G.store.get(KEY)) open(isIOS ? 'ios' : 'android');
})();
