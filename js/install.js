/* 앱 받기 안내 — 웹 주소로 들어온 사람에게 휴대폰에 맞는 설치 방법을 보여 준다. native.js 다음에 불러온다.
 *   안드로이드: APK 내려받기 (앱을 꺼 두어도 알림)
 *   아이폰:     Safari 공유 → 홈 화면에 추가 (iOS 16.4+는 홈 화면에서 연 앱으로 알림 허용 가능)
 *               컴퓨터가 있으면 서명 없는 설치 파일(.ipa)을 Sideloadly 등으로 서명해 설치
 * 이미 설치한 앱(G.native)이나 홈 화면에서 연 웹앱, claude.ai 미리보기에서는 보이지 않는다.
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
  if (G.native || G.inArtifact || standalone || !(isIOS || isAndroid) || G.store.get(KEY)) return;

  var box = $('install');
  function li(html) { var e = document.createElement('li'); e.innerHTML = html; return e; }   // 고정 문구만

  if (isAndroid) {
    $('ins-title').textContent = '안드로이드 앱으로 받기';
    $('ins-sub').textContent = '앱을 꺼 두어도 술자리 끝날 시간에 알림이 화면 위로 뜹니다.';
    $('ins-steps').append(
      li('아래 <b>앱 내려받기</b>를 누릅니다.'),
      li('처음이면 <b>출처를 알 수 없는 앱 설치</b>를 허용하고 설치합니다.'));
    var a = document.createElement('a');
    a.className = 'btn amber'; a.href = G.apkUrl; a.textContent = '앱 내려받기 (APK)';
    $('ins-btns').append(a);
  } else {
    $('ins-title').textContent = '아이폰에서 앱처럼 쓰기';
    $('ins-sub').textContent = '아이폰은 웹에서 앱 파일을 바로 설치할 수 없어, 홈 화면에 추가해 앱처럼 씁니다.';
    $('ins-steps').append(
      li('Safari 아래쪽 <b>공유 버튼</b>(네모에 위쪽 화살표)을 누릅니다.'),
      li('목록에서 <b>홈 화면에 추가</b> → <b>추가</b>를 누릅니다.'),
      li('홈 화면의 <b>귀가약속</b> 아이콘으로 열고, 약속을 저장할 때 알림을 허용합니다. (iOS 16.4 이상)'));
    var more = document.createElement('details');
    more.className = 'ins-more';
    more.innerHTML = '<summary>컴퓨터로 앱 설치하기 (설치 파일 .ipa)</summary>' +
      '<p>Windows나 Mac에서 Sideloadly 같은 도구로 본인 Apple ID로 서명해 설치합니다. 무료 Apple ID로는 7일마다 다시 설치해야 합니다. 이렇게 설치하면 앱을 꺼 두어도 알림이 울립니다.</p>';
    var ipa = document.createElement('a');
    ipa.className = 'btn ghost small'; ipa.href = G.ipaUrl; ipa.textContent = '설치 파일 내려받기 (.ipa)';
    more.append(ipa);
    $('ins-btns').append(more);
  }
  $('ins-close').addEventListener('click', function () { box.hidden = true; G.store.set(KEY, true); });
  box.hidden = false;
})();
