/* 오프라인 캐시. 앱 파일을 고치면 CACHE 버전을 올린다. */
var CACHE = 'gwiga-v8';
var SHELL = [
  './', 'index.html', 'css/style.css',
  'js/util.js', 'js/native.js', 'js/install.js', 'js/alarms.js', 'js/model.js', 'js/group-logic.js', 'js/config.js', 'js/plan.js', 'js/pledge.js', 'js/calc.js',
  'js/group-store.js', 'js/group.js', 'js/main.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  var isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;

  e.respondWith(caches.match(e.request).then(function (hit) {
    var net = fetch(e.request).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () { return hit || caches.match('index.html'); });
    return hit || net;
  }));
});

/* 알림을 누르면 앱을 열고 그 화면(약속·모임·숙취 계산)으로 간다 */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var hash = (e.notification.data && e.notification.data.hash) || 'plan';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if ('focus' in list[i]) {
        if ('navigate' in list[i]) list[i].navigate('./#' + hash).catch(function () {});
        return list[i].focus();
      }
    }
    return self.clients.openWindow('./#' + hash);
  }));
});
