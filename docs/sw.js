/* 考研学习台 Service Worker
   只缓存"应用外壳"（页面本身），绝不缓存云端数据 ——
   数据必须永远走网络，否则会把旧数据当成新数据用（这正是历史上同步出问题的根源之一）。 */
const CACHE = 'studyhub-shell-v1';
const SHELL = ['./', './index.html'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  /* 跨域（GitHub API / jsDelivr）一律直连，不进缓存：数据新鲜度优先于离线 */
  if (url.origin !== self.location.origin) return;
  const isShell = req.mode === 'navigate' || url.pathname === '/' ||
                  url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
  if (!isShell) return;
  e.respondWith(
    fetch(req).then(function (r) {
      const cp = r.clone();
      caches.open(CACHE).then(function (c) { c.put(req, cp); }).catch(function () {});
      return r;
    }).catch(function () {
      return caches.match(req).then(function (r) {
        return r || caches.match('./index.html') || caches.match('./');
      });
    })
  );
});
