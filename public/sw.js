// public/sw.js
self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function () {
  // 今回は最低限のPWA化なので、特別なキャッシュ処理はしない
});
