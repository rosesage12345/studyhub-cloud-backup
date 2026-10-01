/* 考研学习台 Service Worker
   只缓存"应用外壳"（页面本身），绝不缓存云端数据 ——
   数据必须永远走网络，否则会把旧数据当成新数据用（这正是历史上同步出问题的根源之一）。

   离线策略要点：
   · 网络优先：在线时永远拿最新页面，缓存只作为断网兜底
   · 只缓存"正常响应"：否则一次 404/500 会被当成外壳存下来，断网后一直用坏副本
   · 换缓存名会清掉所有旧副本（activate 里删除非当前缓存）—— 发版时若怀疑旧副本作祟就升版本号
*/
const CACHE = 'studyhub-shell-v2';
const SHELL = ['./', './index.html'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return fetch(new Request(u, { cache: 'reload' })).then(function (r) {
          /* 只把正常响应写进外壳缓存 */
          if (r && r.ok) return c.put(u, r);
        }).catch(function () {});
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
      /* 只缓存正常响应：错误页/重定向不进缓存，免得断网时一直用坏副本 */
      if (r && r.ok) {
        const cp = r.clone();
        caches.open(CACHE).then(function (c) { c.put(req, cp); }).catch(function () {});
      }
      return r;
    }).catch(function () {
      return caches.match(req).then(function (r) {
        return r || caches.match('./index.html') || caches.match('./');
      });
    })
  );
});
